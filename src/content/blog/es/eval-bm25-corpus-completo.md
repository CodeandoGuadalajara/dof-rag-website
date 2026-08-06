---
title: "La primera evaluación a escala real: BM25 contra los 657,867 documentos, y el ajuste que convirtió 21 horas de consultas en 34 minutos"
description: "Mientras la corrida de embeddings avanza sobre 6.7 millones de chunks, construimos el índice FTS5 del corpus completo (2.7 GiB), pre-embedamos las 3,023 consultas de evaluación con el mismo GGUF, y corrimos la primera evaluación BM25 a escala real: el MRR bajó de 0.589 a 0.170 al pasar de 499 a 657,867 documentos — la caída esperada. En el camino: un COUNT(*) que miente, 32 documentos casi invisibles para el índice, y una poda de tokens por frecuencia que hace las consultas 25 veces más rápidas sin cambiar los resultados."
date: "2026-08-06"
heroImage: ""
category: "desarrollo"
tags: ["dof-rag", "evaluacion", "bm25", "fts5", "sqlite", "vector-search", "embedding"]
author: "Joaquín Bravo Contreras"
---

## De qué estamos hablando

El [post anterior](/es/blog/2026/08/corpus-completo-bugs-de-escala/) cerró con la corrida de embeddings en marcha: 6.73 millones de chunks a ~5.7 chunks/s, unas 13.5 días de cómputo continuo. Antes de contar lo que hicimos mientras tanto, vale la pena recordar para qué es todo ese cómputo.

El sistema que estamos construyendo responde consultas en lenguaje natural contra los 657,867 documentos del Diario Oficial: entra una pregunta ("¿cómo participo en una licitación del gobierno?") y sale una lista de documentos candidatos. Lo hace con **búsqueda híbrida**: dos mecanismos de recuperación que trabajan por separado y cuyos resultados se fusionan al final.

- **BM25**, la búsqueda clásica por palabras. Un índice de texto completo registra qué documentos contienen cada término; al llegar una consulta, se buscan sus palabras y los documentos se ordenan por relevancia estadística (cuántas veces aparece el término, qué tan raro es en el corpus). Es exacto, pero literal: si el documento correcto no usa las palabras de la consulta, no aparece.
- **Búsqueda vectorial**. Cada chunk de texto se convierte en un vector de 1,024 números (su *embedding*), y la consulta en otro; los chunks cuyos vectores quedan "cerca" del de la consulta son candidatos, aunque no compartan una sola palabra con ella. Captura sinonimia y parafraseo, pero difumina los detalles exactos (números de artículo, fechas, siglas).

La hipótesis del proyecto —ya validada sobre un subconjunto de 499 documentos, donde la fusión ganó con claridad— es que combinando ambos se obtiene mejor resultado que con cualquiera de los dos por separado. La corrida de embeddings que está en curso es precisamente lo que falta para el componente vectorial: convertir los 6.73 millones de chunks del corpus completo en vectores.

Todo lo construido hasta ahora (corpus comprimido, índice de chunks, embeddings en progreso) es infraestructura. La pregunta pendiente es la de calidad: **¿qué tan seguido encuentra el sistema el documento correcto cuando los 657,867 documentos hacen de distractor?** Para medirlo tenemos un set de evaluación: 3,023 consultas cuyo documento correcto conocemos de antemano — el título literal de cada documento, sus primeras palabras, y 2,025 consultas generadas (factuales, temáticas, paráfrasis). Como sabemos cuál documento debería ganar cada consulta, podemos medir en qué posición de la lista apareció. La métrica principal es el **MRR** (Mean Reciprocal Rank): el promedio de 1/posición del documento correcto. Si aparece de primero, aporta 1; de segundo, 0.5; si no aparece en el top-50, aporta 0.

Hasta ahora esa evaluación solo se había corrido contra el subconjunto: las consultas buscaban entre los mismos 499 documentos del set. Esos números eran una cota optimista — encontrar un documento entre 499 es mucho más fácil que entre 657,867. Este post cuenta la primera medición a escala real, la del componente BM25, y todo lo que hubo que construir y corregir para obtenerla.

Resultados primero; cada renglón se desarrolla en una sección:

| Componente | Resultado |
|---|---:|
| Índice FTS5 (BM25) del corpus completo | **~2.7 GiB**, construido en ~8 minutos |
| Consultas de evaluación pre-embedadas | 3,023 (float + binario sign-packed) |
| **BM25 sobre 657,867 documentos: MRR** | **0.170** (subconjunto de 499 docs: 0.589) |
| Costo por consulta BM25 | 17–45 s → **0.7 s** tras podar tokens |
| Smoke test híbrido (vectores parciales) | W0.5 **0.269** > vectores 0.200 > BM25 0.189 |

Sobre el 0.170, la lectura corta es: la caída respecto a 0.589 no es una regresión, es la medición honesta — es lo que cuesta encontrar un documento cuando el corpus completo hace de distractor. La lectura larga, con el desglose por tipo de consulta y lo que implica para la fusión híbrida, está más abajo.

## El índice FTS5: dos trampas y un desajuste de tokenizador

Para evaluar el componente BM25 de la búsqueda híbrida hace falta un índice de texto completo sobre los 657,867 documentos. Usamos FTS5 de SQLite en modo **contenido externo**: la tabla virtual guarda solo el índice (término → lista de documentos), y el texto vive en la tabla `documents` ya comprimida con zstd. Así el índice no duplica los 31.5 GiB de texto; en total agregó ~2.7 GiB a la base.

La construcción es trivial en una muestra (`INSERT INTO documents_fts(documents_fts) VALUES('rebuild')` y listo), pero a escala real aparecieron dos trampas.

### Trampa 1: `COUNT(*)` sobre una tabla FTS5 de contenido externo miente

Nuestro script de construcción era reanudable por diseño: antes de indexar, consultaba cuántas filas ya tenía el índice para continuar desde ahí. La primera corrida reportó:

```
documents: 657,867  already indexed: 657,867
```

Índice "completo" sin haber indexado nada. Lo que ocurre es que en una tabla FTS5 de contenido externo, un `SELECT COUNT(*)` (o un `MAX(rowid)`) **no consulta el índice — consulta la tabla de contenido**. SQLite responde el conteo leyendo `documents`, que por supuesto tiene 657,867 filas. La única forma de saber qué hay realmente en el índice es una consulta `MATCH` (que sí usa el índice) o la tabla sombra `documents_fts_docsize` (una fila por documento indexado). El índice real en ese momento tenía 32 documentos.

Esto va más allá de FTS5. Las tablas virtuales de SQLite implementan sus propias reglas para cada tipo de consulta, y una operación tan inofensiva como contar filas puede estar respondiendo sobre otra cosa. Verifiquen el invariante con una consulta que ejercite el índice, no con una que lo rodee.

### Trampa 2: 32 documentos que el `rebuild` indexa como vacíos

El corpus tiene 32 documentos gigantes (>32 MiB) que no caben en un renglón comprimido y viven segmentados en una tabla aparte; su columna `markdown` en `documents` es una cadena vacía. El `rebuild` estándar los habría indexado como documentos sin texto: presentes en el conteo, invisibles para cualquier búsqueda. Entre ellos está el manual de 671 MiB que ya dio problemas en el chunking, así que no son documentos marginales. El constructor ahora los detecta explícitamente, reensambla su texto desde los segmentos y los inserta como documentos completos.

### El desajuste: tokenizador distinto al de la evaluación de referencia

La evaluación previa (subconjunto de 499 documentos) construía su FTS5 con `unicode61 remove_diacritics 1`: al indexar y al buscar, se quitan acentos y se normaliza a minúsculas. Nuestro primer índice usó el tokenizador por defecto, que conserva acentos. ¿Importa? Sí: con folding, `declaracion` y `declaración` son el mismo término (75,414 documentos en ambos casos); sin folding son dos términos distintos, y cualquier comparación de MRR contra la referencia mezclaría dos efectos: el tamaño del corpus y el tokenizador. Como el objetivo es medir el efecto del corpus, reconstruimos el índice con el mismo tokenizador de la referencia (~8 minutos, nada doloroso) y dejamos ese DDL como el canónico en `corpus_store/acceptance.py`.

## Las consultas, embedadas con el mismo modelo que el corpus

El set de evaluación tiene 3,023 consultas sobre 499 documentos: el título literal de cada documento, las primeras ~20 palabras, y 2,025 consultas generadas (factuales, temáticas, paráfrasis, y de artículos específicos). Para la búsqueda vectorial hay que embedarlas, y aquí hay una restricción fácil de violar: la búsqueda por distancia de Hamming compara bits, así que **consulta y documento deben vivir en el mismo espacio de embeddings**. Los vectores del corpus salen del GGUF local de jina-v5-small corriendo en llama.cpp con el prefijo `Query: ` / `Document: `; las consultas tienen que salir del mismo servidor con el mismo prefijo. Reusar los embeddings cacheados de la API de Jina (que existen de experimentos previos) habría introducido un espacio distinto — medimos el coseno entre ambos por curiosidad: 0.936 en promedio, lo bastante distinto para arruinar una comparación bit a bit.

Las 3,023 consultas se embedaron contra el servidor en producción (compartido con la corrida principal; costó 582 segundos de GPU compartida, imperceptible en el ritmo de 5.66 chunks/s) y quedaron cacheadas en float32 y en binario sign-packed.

## BM25 contra 657,867 documentos

Con el índice y las consultas listas, corrimos la primera mitad de la evaluación: las 3,023 consultas contra el FTS5 del corpus completo, profundidad 50. La tabla compara contra la referencia anterior, el subconjunto de 499 documentos:

| Métrica | Subconjunto (499 docs) | Corpus completo (657,867 docs) |
|---|---:|---:|
| MRR | 0.589 | **0.170** |
| R@1 | 0.530 | 0.119 |
| R@5 | 0.668 | 0.224 |
| R@10 | 0.713 | 0.269 |

Por tipo de consulta (corpus completo):

| Tipo | MRR | n |
|---|---:|---:|
| factual | 0.282 | 1,009 |
| first_words | 0.227 | 499 |
| paráfrasis | 0.118 | 428 |
| artículo específico | 0.118 | 110 |
| título literal | 0.082 | 499 |
| temática | 0.025 | 478 |

Tres observaciones:

1. **La caída de ~3.5x es el efecto distractor esperado.** El corpus completo tiene ~1,319 veces más documentos que el subconjunto; que el MRR baje es la señal de que la evaluación ahora mide dificultad real, no una regresión del sistema.
2. **Las consultas temáticas miden otra cosa.** Su MRR de 0.025 no dice que BM25 sea malo para temas; al revisarlas encontramos que son preguntas de usuario ("¿cómo puedo saber a cuánto debo pagar si mi crédito está en dólares?") que **no identifican un documento único**: su documento esperado es *una* respuesta válida entre cientos o miles. El ejemplo extremo: el tipo de cambio se publica cada día hábil desde hace 27 años, y los tokens más raros del título del documento esperado aparecen en **7,592 documentos** equivalentes — sin la fecha en la consulta, ningún buscador puede distinguir el esperado de los otros 7,591. El problema no es el índice ni el modelo: es que la métrica (posición de UN documento oro) no corresponde a la tarea (encontrar ALGÚN documento que responda). La solución pasa por el set de evaluación, no por el índice: regenerar estas consultas con detalles que identifiquen al documento (fechas, montos, nombres de entidad, números de acuerdo), o tratarlas como evaluación de respuesta con juez, no de retrieval.
3. **El título literal ya no es trivial** (0.082), y aquí hay dos causas mezcladas. La primera es genuina del corpus: con 27 años de ediciones del DOF, cientos de documentos comparten títulos casi idénticos ("ACUERDO por el que se...", mismo trámite, otra fecha). La segunda es un defecto de nuestro propio set de evaluación, descubierto al revisar las consultas: **271 de las 499 consultas de título (54%) no son títulos reales sino nombres de archivo** (`093_AVISO_20180227_MAT_5514595`), usados cuando el documento no tiene un encabezado extraíble. Esa cadena no aparece en el texto del documento, así que la consulta es esencialmente imposible para cualquier buscador de texto — son ceros casi garantizados que deprimen el promedio (y también deprimían las cifras del subconjunto, así que la comparación sigue siendo justa). Queda como pendiente regenerar los títulos desde el primer encabezado del Markdown o excluir estas consultas del set.

## Por qué las consultas eran 25 veces más lentas de lo necesario

La evaluación casi no sucede como estaba planeada. La construcción de consultas MATCH que usa el arnés de referencia es la ingenua: cada palabra de la consulta se vuelve un término entre comillas, unidos con `OR`. Sobre 499 documentos eso es instantáneo; sobre 657,867 medimos **17 a 45 segundos por consulta** — unas 21 horas para el set completo.

La causa está en la forma en que FTS5 calcula el ranking. Para puntuar una consulta con BM25 hay que recorrer la *doclist* (la lista de documentos que contienen cada término) de todos los términos de la consulta. Las palabras funcionales del español tienen doclists monstruosas: `de` aparece en 657,642 de 657,867 documentos (99.97%), `la` en 649,547. Una consulta de 20 palabras con 8 stopwords obliga a FTS5 a leer y puntuar varios millones de entradas por consulta.

Sin embargo, esos términos **cuestan muchísimo y aportan nada al ranking**. BM25 pondera cada término por su IDF (frecuencia inversa de documento), que tiende a cero cuando el término está en la mayoría de los documentos — y en la implementación de FTS5 se vuelve cero o negativo exactamente cuando el término aparece en más de la mitad del corpus. Es decir, `de` no mueve el ranking; solo lo encarece.

Con esa observación en la mano, la salida fue podar las consultas. Construimos una tabla `fts5vocab` con la frecuencia documental de los 2.35 millones de términos del índice, y eliminamos de cada consulta los tokens con frecuencia mayor a N/2. Antes de adoptarla verificamos la equivalencia: en las consultas de prueba, el top-50 es idéntico documento por documento en un caso, y en los demás difiere solo en el orden de la cola, con la posición del documento correcto intacta. Con eso, el costo bajó a **0.7 segundos por consulta, 34 minutos para las 3,023**, con las mismas listas rankeadas.

## Smoke test del pipeline híbrido completo

El componente vectorial de la evaluación necesita los 6.73 millones de vectores, que aún no existen. Pero el índice de búsqueda (sqlite-vec, `bit[1024]`) es reanudable por `rowid`, así que lo construimos sobre los vectores ya escritos (768 mil en ese momento, 2 segundos de construcción) y corrimos el arnés híbrido completo como prueba de mecánica, restringiendo las métricas a las 335 consultas cuyo documento esperado ya está embedado:

| Sistema | MRR | R@1 | R@10 |
|---|---:|---:|---:|
| W0.5 (BM25 + vectores, α=0.5) | **0.269** | 0.203 | 0.394 |
| RRF | 0.262 | 0.188 | 0.412 |
| solo vectores (colapsados a documento) | 0.200 | 0.134 | 0.328 |
| solo BM25 | 0.189 | 0.125 | 0.299 |

Dos cosas se querían ver y se vieron. Primero, la mecánica funciona de punta a punta: consulta binaria → Hamming k=50 sobre el índice → colapso de chunks a documentos (cada documento hereda la distancia de su mejor chunk) → fusión ponderada con normalización min-max contra las listas de BM25. Segundo, **la fusión híbrida ya supera a cada componente por separado**, reproduciendo el patrón del subconjunto de 499 documentos, donde la híbrida era la clara ganadora. Conviene repetir la salvedad: en este modo la búsqueda vectorial opera solo sobre los documentos ya embedados mientras BM25 busca en todo el corpus, así que son números de validación de mecánica, no de calidad final.

El desglose por tipo de consulta confirma la división de trabajo esperada entre los dos componentes:

| Tipo | solo BM25 | solo vectores | W0.5 |
|---|---:|---:|---:|
| factual | 0.317 | 0.208 | 0.359 |
| first_words | 0.287 | 0.315 | 0.441 |
| paráfrasis | 0.135 | 0.340 | 0.303 |
| artículo específico | 0.020 | 0.100 | 0.200 |
| temática | 0.058 | 0.106 | 0.116 |
| título literal | 0.023 | 0.043 | 0.044 |

BM25 gana donde la consulta usa las palabras del documento (factual), los vectores ganan donde la consulta parafrasea o pregunta por temas (paráfrasis, temática, artículos), y la fusión queda por encima de ambos en casi todo. Las consultas temáticas quedan bajas en absoluto en todos los sistemas (0.116 incluso con fusión), pero ya sabemos por qué: el documento oro es una respuesta válida entre cientos o miles de equivalentes, y la métrica solo da crédito por ese. Hasta que el set de evaluación distinga "encontrar ESTE documento" de "encontrar ALGÚN documento que responda", ese renglón no mide calidad de retrieval sino ambigüedad de la tarea.

Dos experimentos rápidos sobre estos números. Primero, probamos si la profundidad k=50 del barrido Hamming estaba cortando documentos correctos: con k=200 el MRR vectorial pasó de 0.200 a 0.201 — nada. Los documentos que se pierden no se pierden por el corte de profundidad, se pierden porque sus chunks no rankean. Segundo, aislando el defecto de los títulos-archivo: al excluir las 40 consultas de título-slug del grupo elegible, el W0.5 sube de 0.265 a **0.301** (vectores 0.201 → 0.228, BM25 0.189 → 0.214). Parte de la caída respecto al subconjunto era, entonces, ruido del set de evaluación; el resto es dificultad genuina del corpus completo.

## Actualización: el set de evaluación v3 y sus resultados

Una semana de trabajo después de lo narrado arriba, los dos defectos del set de evaluación quedaron corregidos y los números cambian bastante. La construcción de la v3 tuvo dos partes. La primera fue gratis: los 271 títulos-archivo se reemplazaron por títulos reales extraídos programáticamente — el DOF casi nunca usa encabezados markdown para el título, pero la gran mayoría de los documentos abre con la institución y el título en bloques de negritas (`**SECRETARIA DE...** **ACUERDO...**`), y los edictos judiciales con un bloque de texto plano; tres reglas simples (encabezados markdown, bloques bold, primeras líneas) cubrieron los 271/271. La segunda parte usó LLM: las consultas temáticas y de paráfrasis se regeneraron con instrucciones de incluir detalles identificadores (fechas, montos, dependencias, números de acuerdo o licitación), y cada consulta generada pasó una validación programática de ancla — debe contener al menos un token que aparece en el documento y que existe en menos del 0.1% del corpus (verificable contra la tabla `fts5vocab`), o un número de cuatro o más dígitos. El modelo fue `kimi-for-coding` con el modo thinking desactivado (los tokens de thinking se facturan como output; apagarlos ahorró ~0.5M de tokens), y el costo total por las 896 consultas regeneradas fue de ~0.95M tokens de entrada y ~30k de salida, sin un solo error.

En el camino apareció un tercer bug, esta vez en el arnés de evaluación: las consultas de título literal no se construían desde el campo `title` del dataset sino desde los encabezados que detecta el chunker, así que la corrección de títulos no tenía efecto hasta que el arnés aprendió a preferir el título del dataset.

Los resultados de BM25 sobre el corpus completo, v2 contra v3:

| Tipo | v2 MRR | v3 MRR |
|---|---:|---:|
| **total** | 0.170 | **0.366** |
| temática | 0.025 | **0.641** |
| paráfrasis | 0.118 | **0.611** |
| título literal | 0.082 | 0.260 |
| factual | 0.282 | 0.282 |
| first_words | 0.227 | 0.227 |
| artículo específico | 0.118 | 0.118 |

El sistema nunca fue tan malo como v2 sugería: más de la mitad de la caída por distractores era ruido del set de evaluación. Y la dificultad se redistribuye de forma interesante — las consultas con anclas le juegan a favor de BM25, porque los tokens raros (fechas, montos, códigos de licitación como `LO-013J2W002-E21-2023`) son exactamente lo que el IDF premia. La temática pasó de peor tipo a mejor. La dificultad genuina que queda está en las consultas cuyo oro es un *chunk* dentro de un documento (first_words, artículo específico): ahí el problema es de granularidad, no de vocabulario.

El smoke test híbrido también se re-corrió con v3 (665 consultas elegibles, 1.39 millones de vectores ya embedados):

| Sistema | MRR | R@1 | R@10 |
|---|---:|---:|---:|
| W0.5 (BM25 + vectores, α=0.5) | **0.402** | 0.305 | 0.589 |
| W0.75 (más peso a BM25) | 0.399 | 0.310 | 0.565 |
| RRF | 0.382 | 0.277 | 0.579 |
| solo BM25 | 0.362 | 0.263 | 0.535 |
| W0.25 (más peso a vectores) | 0.309 | 0.239 | 0.445 |
| solo vectores | 0.252 | 0.189 | 0.374 |

Y por tipo, el detalle que cambia la conversación:

| Tipo | solo BM25 | solo vectores | W0.5 |
|---|---:|---:|---:|
| paráfrasis | **0.637** | 0.298 | 0.614 |
| temática | 0.577 | 0.407 | **0.609** |
| first_words | 0.275 | 0.283 | **0.388** |
| factual | 0.274 | 0.173 | **0.306** |
| título literal | 0.232 | 0.198 | **0.259** |
| artículo específico | 0.104 | 0.208 | **0.251** |

Tres lecturas. Primero, con consultas ancladas el ranking de componentes se invierte: BM25 (0.362) supera claramente a los vectores binarios (0.252), al revés de lo que veíamos con las consultas v2. Segundo, la fortaleza de los vectores se concentra ahora donde el oro es un fragmento específico del documento: en artículo específico duplican a BM25 (0.208 contra 0.104). Tercero, la fusión W0.5 gana el total no por ganar en todas partes — en paráfrasis pierde contra BM25 solo (0.614 contra 0.637) — sino por no colapsar en ningún tipo. Eso refuerza el argumento del peso adaptativo por pregunta que plantea el [post de benchmarks](/es/blog/2026/08/benchmark-hibrido-m3-gguf/): un α fijo deja puntos sobre la mesa en ambos sentidos.

Queda pendiente la evaluación final contra los 6.73 millones de vectores completos, que reportaremos en ambos cortes (v2 y v3) para mantener la comparabilidad histórica.

## Estado y lo que falta

1. **Corpus, chunks, FTS5**: construidos y verificados.
2. **Embeddings**: ~1.4 millones de 6.73 millones de vectores, ritmo constante de 5.66 chunks/s, ETA alrededor del 17 de agosto. Reanudable, como debe ser.
3. **Evaluación**: BM25 medido en v2 (0.170) y v3 (0.366); smoke test híbrido v3 (W0.5 0.402) con el patrón híbrido intacto. Cuando terminen los vectores, la evaluación final completa son dos comandos.
4. **Pendiente no técnico**: la revisión de licencias de sqlite-vector (Elastic 2.0 modificada) y sqlite-zstd (LGPL-3.0) antes de cualquier despliegue en producción. sqlite-vec, la dependencia que sí estamos usando para vectores, es MIT.
5. ~~**Set de evaluación**~~: v3 construida y validada (arriba). La evaluación final reportará ambos cortes.
6. **Herramientas de búsqueda para el agente** (del plan del [post de benchmarks](/es/blog/2026/08/benchmark-hibrido-m3-gguf/)): además de BM25 y vectores, el corpus ya permite herramientas de metadata que convertirían consultas imposibles en triviales — búsqueda por título (el extractor de la v3 ya demuestra la regla de bloques bold), lookup directo por ruta/slug, y filtros por fecha, sección y emisor (las columnas ya existen). Con un agente que clasifique la pregunta y elija herramienta y peso de fusión por caso, los tipos de consulta que hoy se ven "malos" cambian de naturaleza.

El número a vigilar cuando llegue la evaluación final: no el MRR absoluto (que será bajo comparado con el subconjunto, por diseño), sino **la brecha entre la híbrida y cada componente por separado**. Si en el corpus completo la fusión sigue ganando por el mismo margen relativo que en el subconjunto, la arquitectura se sostiene a escala real. Lo contamos en el siguiente post.
