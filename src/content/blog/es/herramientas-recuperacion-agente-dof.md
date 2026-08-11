---
title: 'De encontrar documentos a encontrar evidencia: primeras herramientas para consultar el DOF'
description: 'Separamos la búsqueda documental de la recuperación de pasajes, definimos cinco herramientas verificables y las medimos con eval v4 antes de conectar un modelo de lenguaje.'
date: '2026-08-11'
heroImage: ''
category: 'desarrollo'
tags:
  [
    'dof-rag',
    'retrieval',
    'bm25',
    'herramientas',
    'rag-agentico',
    'evaluacion',
    'evidencia',
  ]
author: 'Joaquín Bravo Contreras'
---

## El problema apareció antes de conectar un modelo de lenguaje

La [evaluación v4](/es/blog/2026/08/eval-v4-evidencia-retrieval/) dejó una separación clara. Una búsqueda puede encontrar la publicación correcta y, aun así, no entregar el artículo, transitorio o tabla que permite contestar la pregunta.

Esto cambia la arquitectura del sistema. Buscar entre 657,867 publicaciones y buscar dentro de veinte documentos candidatos son tareas distintas:

1. la primera necesita distinguir fechas, ediciones y documentos muy parecidos;
2. la segunda necesita localizar pasajes concretos dentro de textos que pueden tener cientos de chunks.

Podríamos haber conectado un modelo de lenguaje al primer buscador disponible y pedirle que respondiera. El problema es que entonces mezclaríamos dos fallas. Si la respuesta fuera incorrecta, no sabríamos si el modelo interpretó mal la evidencia o si nunca recibió el pasaje necesario.

Por eso el primer avance hacia un RAG agéntico no fue el agente. Construimos herramientas deterministas, medimos qué recuperan y mantuvimos el modelo generativo fuera del experimento. La implementación está en el PR [#67 de dof-rag](https://github.com/CodeandoGuadalajara/dof-rag/pull/67).

## Qué significa una herramienta en este sistema

Una herramienta es una función con entradas y salidas definidas. Recibe, por ejemplo, una consulta, un rango de fechas y una profundidad; devuelve identificadores de documentos, puntajes y metadatos. La misma llamada debe producir el mismo resultado mientras los índices no cambien.

El futuro agente no reemplazará estas funciones. Su trabajo será decidir cuáles usar, con qué argumentos y cuándo tiene evidencia suficiente para contestar. Esta separación permite probar dos partes de manera independiente:

- el buscador se evalúa con documentos y chunks de referencia;
- el modelo se evalúa por las decisiones que toma y por la respuesta que construye con los resultados.

Definimos cinco operaciones iniciales:

| Herramienta                                      | Qué devuelve                            | Para qué sirve                                       |
| ------------------------------------------------ | --------------------------------------- | ---------------------------------------------------- |
| `list_publications(filters)`                     | Publicaciones ordenadas por fecha       | Consultas sobre una fecha o edición concreta         |
| `search_documents(query, strategy, filters)`     | Documentos candidatos                   | Descubrimiento con BM25, vectores o búsqueda híbrida |
| `search_evidence(query, document_ids, strategy)` | Chunks dentro de documentos conocidos   | Localizar el pasaje que sostiene la respuesta        |
| `get_document_outline(document_id)`              | Índice de chunks, encabezados y tamaños | Navegar artículos, listas y referencias cruzadas     |
| `read_chunks(chunk_ids, neighbor_window)`        | Texto reconstruido y chunks vecinos     | Leer la evidencia final con su contexto inmediato    |

Las entradas y salidas tienen tipos explícitos. Un resultado documental no se puede confundir con un chunk; una estrategia solo puede ser `lexical`, `vector` o `hybrid`; una fecha inválida se rechaza antes de consultar SQLite.

## Los filtros disponibles y los que todavía faltan

El corpus permite filtrar de forma confiable por:

- fecha de corte;
- fecha inicial y final;
- sección matutina, vespertina o extraordinaria.

Todavía no expusimos institución emisora ni tipo de documento como filtros. El artículo anterior planteaba esas opciones, pero la base actual no tiene columnas versionadas y validadas para aplicarlas en todos los documentos. Añadir el argumento a una función sería sencillo; garantizar que no descarte publicaciones correctas requiere primero construir esa metadata.

La herramienta falla si recibe un filtro que no puede cumplir. Es preferible declarar una limitación que devolver una lista que parece filtrada, pero no lo está.

## Un ejemplo con los salarios mínimos de 2026

Una pregunta de pasaje único de v4 dice:

> ¿Cuáles son los salarios mínimos generales diarios que rigen en 2026 para la zona general y la frontera norte?

La primera llamada descubre documentos:

```text
search_documents(
  query="salarios mínimos generales diarios 2026 zona general frontera norte",
  strategy="lexical",
  filters={"as_of": "2026-04-24"},
  top_k=20
)
```

BM25 coloca en primer lugar el documento `651143`, la resolución de la CONASAMI publicada el 9 de diciembre de 2025. Hasta aquí sabemos qué publicación contiene la respuesta, pero no qué parte conviene enviar al modelo.

La segunda llamada restringe la búsqueda a los documentos candidatos:

```text
search_evidence(
  query="salarios mínimos generales diarios 2026 zona general frontera norte",
  document_ids=[651143, ...],
  strategy="lexical",
  top_k=20
)
```

El chunk `6632609` aparece en la posición 5. Contiene los dos datos requeridos: 315.04 pesos por jornada diaria en la zona general y 440.87 pesos en la Zona Libre de la Frontera Norte, con vigencia a partir del 1 de enero de 2026.

Antes de contestar, el sistema puede pedir el fragmento anterior y el siguiente:

```text
read_chunks(chunk_ids=[6632609], neighbor_window=1)
```

El contexto vecino ayuda cuando una condición, encabezado o fecha quedó en el límite entre chunks. También conserva los identificadores estables que después se usan como citas.

## Por qué cambiamos el ordenamiento de chunks

El primer prototipo asignaba puntos por coincidencias de palabras. Además, multiplicaba el puntaje por una función del tamaño del chunk. Dos fragmentos con las mismas coincidencias podían quedar ordenados a favor del más largo, aunque el texto adicional no aportara nada.

Lo sustituimos por BM25 aplicado al conjunto acotado de chunks de los documentos candidatos. BM25 combina tres ideas:

1. una palabra que aparece varias veces en un fragmento puede ser relevante;
2. una palabra que aparece en casi todos los fragmentos distingue poco;
3. los textos largos deben normalizarse para que su tamaño no produzca una ventaja automática.

El cálculo en esta etapa es local. No busca de nuevo entre los 6.73 millones de chunks; compara únicamente los fragmentos de los documentos que superaron la primera búsqueda. Más adelante podremos sustituirlo por un índice FTS5 de chunks o por un reranker sin cambiar el contrato de la herramienta.

## Citas que el modelo no puede inventar

Cada chunk se reconstruye desde el corpus comprimido mediante su receta de offsets. Antes de devolver el texto, la herramienta calcula su hash y lo compara con el registrado durante el chunking. Si no coincide, la lectura falla en vez de entregar contenido dudoso.

La capa de respuesta aplica otra restricción: un modelo solo puede citar identificadores incluidos en el contexto que recibió. Si propone el chunk `999` y ese chunk no estaba entre los resultados, el sistema lo elimina de las citas válidas y lo registra como cita inválida.

Esto no demuestra que una cita válida sostenga realmente una afirmación. Sí evita una falla más básica: presentar como consultada una fuente que nunca se entregó al modelo. Eval v4 puede medir después si las citas permitidas coinciden con los chunks de referencia.

Cada corrida también registra las versiones del corpus y del chunker. En esta prueba fueron `dof-full-v1` y `dof-chunker-v1`. Comparar dos resultados sin estas versiones permitiría atribuir al buscador una diferencia causada por datos o fragmentos distintos.

## Qué cambió en eval v4

El runner anterior calculaba métricas hasta top-20, pero el buscador solo devolvía doce chunks. En la práctica, la cifra presentada como recall@20 era recall@12. El nuevo runner exige al menos veinte resultados cuando reporta top-20 y separa dos MRR:

- MRR del primer documento correcto;
- MRR del primer chunk de evidencia correcto.

También registra profundidades, tiempos por etapa, estrategia utilizada, versiones de índices y citas inválidas. Esto permite reproducir una corrida sin deducir parámetros a partir del código.

## Resultado sobre las 42 preguntas

Comparamos el prototipo original con las nuevas herramientas usando únicamente BM25. El índice vectorial sigue incompleto y no era necesario para aislar el cambio en la búsqueda dentro de documentos.

| Métrica                             | Prototipo | Herramientas nuevas |
| ----------------------------------- | --------: | ------------------: |
| MRR del primer chunk de evidencia   |     0.092 |           **0.104** |
| Recall de evidencia@1               | **0.060** |               0.048 |
| Recall de evidencia@5               |     0.083 |           **0.167** |
| Recall de evidencia@10              |     0.155 |           **0.187** |
| Recall de evidencia@5, pasaje único |     0.167 |           **0.500** |

La mejora no es uniforme. El primer resultado correcto bajó ligeramente, mientras que la cobertura entre las primeras cinco y diez posiciones aumentó. Para construir contexto, esta diferencia importa: un reranker posterior puede trabajar con cinco o diez candidatos, pero no puede recuperar un pasaje que quedó fuera de la lista.

El recall documental@10 se mantuvo en 0.429 y el all-hop@10 en 0.405. Era lo esperado porque el cambio principal ocurrió después de la selección de documentos.

## Dos categorías siguen sin evidencia correcta

Las seis preguntas de monitoreo y las seis de premisa falsa conservaron recall de evidencia igual a cero.

En monitoreo, la pregunta suele dar una fecha y una institución: “¿Qué publicó el INEGI el 9 de enero de 2026?”. Una consulta BM25 larga mezcla la fecha, la institución y los datos solicitados. La ruta más directa sería listar primero todas las publicaciones de ese día y después buscar dentro de ese conjunto. La herramienta ya permite esa secuencia; falta que un agente decida usarla.

Las premisas falsas presentan otro problema. Si alguien pregunta por el “artículo 99” de un decreto que no lo contiene, las palabras de la premisa pueden alejar la búsqueda de la estructura real del documento. Para corregir la pregunta no basta con encontrar una oración parecida. Hay que identificar el decreto y revisar su índice o sus resolutivos para comprobar que el artículo no existe.

Estas fallas no se corrigen pidiendo al modelo que sea más cuidadoso. Primero necesita una ruta de consulta que permita reunir la evidencia adecuada.

## El siguiente experimento

El próximo paso es conectar un modelo con llamadas a herramientas, con límites explícitos de turnos y número de consultas. Empezaremos con siete preguntas de v4, una por categoría, y compararemos tres resultados:

1. recuperación determinista sin modelo;
2. recuperación seguida de una sola generación;
3. un modelo que puede elegir y repetir herramientas antes de contestar.

Guardaremos cada llamada, sus argumentos, los identificadores devueltos, tiempos, tokens y citas finales. La comparación servirá para saber si la libertad de hacer varias consultas mejora la evidencia o solo aumenta costo y latencia.

Este primer hito no demuestra que el agente resuelva las 42 preguntas. Define las operaciones que podrá usar y muestra, con la misma evaluación, qué mejoró y qué sigue pendiente. El artículo permanecerá en borrador hasta incorporar los resultados del siguiente experimento.
