---
title: 'De encontrar documentos a encontrar evidencia: primeras herramientas para consultar el DOF'
description: 'Separamos la búsqueda documental de la recuperación de pasajes y construimos un bucle acotado, trazable y evaluable para que un modelo use cinco herramientas sobre el DOF.'
date: '2026-08-13'
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
    'kimi',
  ]
author: 'Joaquín Bravo Contreras'
---

## El problema apareció antes de conectar un modelo de lenguaje

La [evaluación v4](/es/blog/2026/08/eval-v4-evidencia-retrieval/) dejó una separación clara. Una búsqueda puede encontrar la publicación correcta y, aun así, no entregar el artículo, transitorio o tabla que permite contestar la pregunta.

Esto cambia la arquitectura del sistema. Buscar entre 657,867 publicaciones y buscar dentro de veinte documentos candidatos son tareas distintas:

1. la primera necesita distinguir fechas, ediciones y documentos muy parecidos;
2. la segunda necesita localizar pasajes concretos dentro de textos que pueden tener cientos de chunks.

Podríamos haber conectado un modelo de lenguaje al primer buscador disponible y pedirle que respondiera. El problema es que entonces mezclaríamos dos fallas. Si la respuesta fuera incorrecta, no sabríamos si el modelo interpretó mal la evidencia o si nunca recibió el pasaje necesario.

Por eso el primer avance hacia un RAG agéntico no fue el agente. Construimos herramientas deterministas, medimos qué recuperan y mantuvimos el modelo generativo fuera del experimento. El trabajo completo está en el PR [#67 de dof-rag](https://github.com/CodeandoGuadalajara/dof-rag/pull/67); el primer corte quedó registrado en el commit [`3b3ecd2`, “add evidence retrieval tools”](https://github.com/CodeandoGuadalajara/dof-rag/commit/3b3ecd25d3e9cf8e1508a5263dfca4793a138e34).

## Qué significa una herramienta en este sistema

Una herramienta es una función con entradas y salidas definidas. Recibe, por ejemplo, una consulta, un rango de fechas y una profundidad; devuelve identificadores de documentos, puntajes y metadatos. La misma llamada debe producir el mismo resultado mientras los índices no cambien.

El bucle agéntico no reemplaza estas funciones. Su trabajo es decidir cuáles usar, con qué argumentos y cuándo tiene evidencia suficiente para contestar. Esta separación permite probar dos partes de manera independiente:

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

La capa de respuesta aplica otra restricción: un modelo solo puede citar identificadores que haya obtenido mediante `read_chunks`. Un resultado de `search_evidence` sirve para elegir qué leer, pero su resumen no autoriza todavía una cita. Si el modelo propone el chunk `999` y nunca lo leyó, el sistema lo elimina de las citas válidas y lo registra como cita inválida.

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

## Segundo hito: un bucle de herramientas ejecutable

El siguiente paso llegó en el commit [`0f4deee`, “add bounded tool-calling loop”](https://github.com/CodeandoGuadalajara/dof-rag/commit/0f4deee568253ab86d6173a0f8aaa3203f417a38). Es un orquestador pequeño, no un marco general de agentes. En cada turno ocurre una de dos cosas:

1. el modelo solicita una herramienta con argumentos estructurados;
2. el modelo entrega la respuesta final.

Cuando hay una solicitud, el programa valida los argumentos, ejecuta la función local y devuelve el resultado asociado al identificador de esa llamada. Después el modelo puede hacer otra consulta o terminar. El proceso tiene dos límites independientes: seis turnos del modelo y ocho llamadas a herramientas por pregunta.

```text
pregunta
   ↓
modelo ──solicita herramienta──→ validador ──→ DOF-RAG/SQLite
   ↑                                      │
   └──────── resultado + call_id ─────────┘
   │
   └── respuesta JSON → validación de citas
```

El límite no es sólo una protección de costo. También vuelve comparables las corridas. Si una configuración usa veinte búsquedas para resolver una pregunta que otra contesta con tres, esa diferencia debe aparecer en la evaluación.

Las herramientas tampoco se muestran todas al mismo tiempo. El recorrido tiene cuatro estados: descubrir documentos, descubrir chunks, leer chunks y responder. En cada estado el modelo sólo ve las operaciones válidas. Esto redujo búsquedas repetidas y el tamaño del contexto, y reserva los últimos turnos para producir o reparar el JSON final.

## Esquemas estrictos y errores visibles

Cada herramienta se entrega al modelo como un esquema JSON estricto. Todas las propiedades están declaradas, no se permiten campos adicionales y los argumentos opcionales se representan como valores nulos. Es el contrato recomendado para el [modo estricto de function calling](https://developers.openai.com/api/docs/guides/function-calling). Ésta es una versión abreviada del contrato de lectura:

```json
{
  "name": "read_chunks",
  "strict": true,
  "parameters": {
    "type": "object",
    "properties": {
      "chunk_ids": {
        "type": "array",
        "items": { "type": "integer" },
        "minItems": 1,
        "maxItems": 8
      },
      "neighbor_window": {
        "type": "integer",
        "minimum": 0,
        "maximum": 1
      }
    },
    "required": ["chunk_ids", "neighbor_window"],
    "additionalProperties": false
  }
}
```

La validación se repite en el servidor antes de tocar las bases. Un nombre de herramienta desconocido, JSON mal formado, más de ocho chunks o una fecha posterior al corte producen un error estructurado dentro de la traza. El modelo puede corregir la llamada en el siguiente turno, pero no puede ampliar silenciosamente el alcance de la consulta.

También se valida el recorrido. `search_evidence` sólo acepta documentos que una llamada anterior haya devuelto; `read_chunks` sólo acepta chunks descubiertos mediante búsqueda o navegación del índice. Así, la traza muestra de dónde salió cada identificador y no permite que el modelo pruebe números arbitrarios hasta encontrar uno existente.

La fecha de corte pertenece a la ejecución, no queda a criterio del modelo. Si la pregunta se evalúa al 24 de abril de 2026, pasar `null` conserva ese corte; pedir una fecha posterior falla. Esto evita que una respuesta histórica use una publicación futura.

## Las capacidades anunciadas dependen de la configuración

El contrato admite búsqueda `lexical`, `vector` e `hybrid`, pero el modelo sólo ve las estrategias que la sesión puede ejecutar. Sin un generador de embeddings de consulta, el esquema enumera únicamente `lexical`.

Esta distinción importa mientras continúa la indexación vectorial. La existencia de una base vec0 parcial no significa que cualquier consulta híbrida sea válida: también hace falta generar el vector de la pregunta y conocer la cobertura del índice. Cuando ambos están disponibles, el orquestador añade las otras dos estrategias y reutiliza el embedding de una consulta repetida durante la misma ejecución.

## Qué contiene una traza

Cada llamada registra:

- número de turno y secuencia;
- nombre y argumentos;
- resultado completo o error estructurado;
- tiempo de ejecución;
- identificador de llamada que enlaza la solicitud y la respuesta.

La ejecución agrega la respuesta final, citas aceptadas y rechazadas, motivo de terminación, tokens de entrada y salida y latencia total. Hay dos adaptadores. El primero usa la API Responses de OpenAI con `store: false`, conserva los elementos de salida necesarios entre turnos y aplica un [esquema de salida estructurada](https://developers.openai.com/api/docs/guides/structured-outputs). El segundo usa Chat Completions compatible con OpenAI y conserva el campo `reasoning_content` que devuelven modelos como Kimi. El orquestador y las herramientas no dependen de ninguno de los dos protocolos, y las pruebas unitarias usan respuestas guionadas sin red.

Hicimos una integración local completa con la pregunta `SP-001`, usando decisiones guionadas para excluir la variación del modelo:

```text
1. search_documents  → documento 651143
2. search_evidence   → candidatos dentro del documento
3. read_chunks       → chunk 6632609
4. respuesta         → cita aceptada: 6632609
```

La búsqueda documental tomó 1.68 segundos en la primera ejecución y 0.50 segundos al repetirla con cachés calientes; la búsqueda interna tomó 8.6–8.7 milisegundos y la lectura verificada, 0.6 milisegundos. El resultado final conservó los valores de 315.04 y 440.87 pesos y rechazó cualquier cita que no proviniera de la tercera llamada. Son comprobaciones de integración en una sola máquina, no un benchmark de latencia.

## Cómo ejecutamos la muestra de v4

El nuevo runner selecciona por omisión una pregunta por categoría:

| Categoría            | Pregunta |
| -------------------- | -------- |
| Pasaje único         | `SP-001` |
| Enumeración          | `LI-001` |
| Temporal/transitorio | `TE-001` |
| Referencia cruzada   | `CR-001` |
| Múltiples documentos | `MD-001` |
| Monitoreo            | `MO-001` |
| Premisa falsa        | `NE-001` |

También puede recibir una lista explícita de IDs o ejecutar las 42 preguntas. El reporte calcula precisión y recall de citas contra los chunks anotados, corrección de premisa falsa, errores de herramientas, turnos, llamadas, tokens y latencia. La corrección general de la respuesta sigue requiriendo revisión humana o un juez separado; no la inferimos a partir de una cita coincidente.

Después de obtener autorización explícita para enviar datos públicos del DOF, intentamos la muestra con `gpt-5.6-luna`, esfuerzo `low`, BM25 y `store: false`. Las siete solicitudes recibieron `429 insufficient_quota`: la cuenta configurada no tenía créditos. El resultado fue 0 de 7 preguntas completadas, sin turnos válidos, llamadas a herramientas, tokens reportados ni métricas de calidad. Como el rechazo ocurrió en la primera solicitud de cada pregunta, ninguna herramienta llegó a recuperar fragmentos para un turno posterior.

La primera versión del runner siguió probando las siete preguntas porque trataba cada error como independiente. La corrida permitió detectar esa conducta. La corrección quedó aislada en [`594b0d3`, “stop after fatal provider errors”](https://github.com/CodeandoGuadalajara/dof-rag/commit/594b0d36b03424ce0f8d22491a2394eb902ccbf2): ahora los errores de autenticación, permiso y saldo insuficiente abortan la sesión después del primer rechazo y marcan el resto como no ejecutado; un límite transitorio de solicitudes sigue tratándose como recuperable. Esto evita siete llamadas destinadas a fallar sin ocultar cuántas preguntas quedaron pendientes.

## Una segunda conexión con Kimi K2.7 Code

La cuenta de Kimi Code disponible en el proyecto sí tenía cuota. Este producto usa un endpoint distinto de la plataforma de pago por uso. De acuerdo con la [documentación de Kimi Code](https://www.kimi.com/code/docs/en/), su interfaz compatible con OpenAI está en `https://api.kimi.com/coding/v1` y Kimi K2.7 Code se solicita con el identificador `kimi-for-coding`, no con `kimi-2.7`.

La primera prueba confirmó que el modelo podía llamar las herramientas, pero también expuso tres problemas del orquestador: ofrecíamos demasiadas operaciones en cada turno, contábamos una ejecución agotada como completada y sólo aceptábamos JSON sin cercas de Markdown. Una muestra de siete preguntas con cuatro turnos terminó con 0 de 7 respuestas válidas, aunque una ejecución aislada de `SP-001` sí había encontrado y citado el chunk correcto.

El adaptador de Kimi y los cambios derivados de estas pruebas están juntos en [`d1c3075`, “add Kimi tool-calling adapter”](https://github.com/CodeandoGuadalajara/dof-rag/commit/d1c30759c07c453d5ad1b2f73f9326054be52a63). Ahí corregimos el criterio de éxito, convertimos el recorrido en una máquina de estados, aceptamos un objeto JSON aun cuando venga dentro de una cerca y aumentamos el presupuesto a seis turnos sin cambiar el máximo de ocho herramientas. Además, el turno de cierre usa `tool_choice: none` y una instrucción explícita para impedir nuevas búsquedas.

La segunda corrida usó BM25, Kimi K2.7 Code y las mismas siete preguntas congeladas. El índice vectorial no intervino.

| Métrica                              | Resultado |
| ------------------------------------ | --------: |
| Ejecuciones con cierre válido        |       7/7 |
| Precisión de citas                   |     0.429 |
| Recall de citas                      |     0.357 |
| Corrección de premisa falsa (`n=1`)  |     1.000 |
| Llamadas a herramientas por pregunta |      3.14 |
| Turnos del modelo por pregunta       |      4.71 |
| Errores de herramientas              |         1 |
| Latencia promedio                    |    78.6 s |
| Tokens de entrada                    |   155,356 |
| Tokens de salida                     |    14,997 |
| Tokens totales                       |   170,353 |

“Cierre válido” sólo significa que el proceso terminó con el esquema esperado. No implica que la respuesta sea correcta. La precisión y el recall comparan los IDs citados con los chunks anotados en v4; una respuesta sin citas recibe cero. El conteo de tokens es el reportado por el endpoint y sirve para comparar configuraciones, aunque la cuenta Kimi Code se rige por la cuota de la membresía.

## Revisión de las siete respuestas

Revisamos manualmente cada respuesta contra las anotaciones de v4:

| Pregunta | Evaluación  | Qué ocurrió                                                                                             |
| -------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `SP-001` | Correcta    | Recuperó 315.04 y 440.87 pesos y citó el chunk `6632609`.                                               |
| `NE-001` | Correcta    | Rechazó la existencia del “artículo 99” y citó los resolutivos reales.                                  |
| `LI-001` | Parcial     | Explicó los rangos de 16–50 y más de 50, pero no recuperó la regla completa para hasta 15 trabajadores. |
| `MD-001` | Parcial     | Dio correctamente los valores de 2025, pero no leyó la evidencia de 2026.                               |
| `CR-001` | No resuelta | Recuperó otra NOM-035 y se abstuvo.                                                                     |
| `MO-001` | No resuelta | Seleccionó una publicación distinta del 9 de enero y concluyó que faltaba evidencia.                    |
| `TE-001` | No resuelta | Encontró una referencia posterior a la NOM, no sus transitorios.                                        |

El resultado manual es dos respuestas correctas, dos parciales y tres no resueltas. No observamos respuestas que inventaran valores: cuando la evidencia era insuficiente, Kimi tendió a abstenerse. Esa prudencia evita una respuesta falsa, pero no compensa una recuperación equivocada.

Dos ejemplos muestran la diferencia. En `SP-001`, la secuencia fue la esperada:

```text
search_documents → search_evidence → read_chunks(6632609) → respuesta
```

La respuesta reprodujo ambos salarios y la cita coincidió con v4. En `NE-001`, el retrieval determinista original tenía recall de evidencia igual a cero para la categoría de premisa falsa. El agente localizó el decreto, leyó sus resolutivos y contestó que no existe el artículo 99. Aquí la navegación sí añadió una capacidad que la consulta única no había mostrado.

Las fallas también son específicas. `CR-001` y `TE-001` confunden normas que comparten el número 035; hace falta dar más peso al identificador completo `NOM-035-STPS-2018`. En `MO-001`, el documento correcto era `652586`, pero el agente eligió `652600`; listar publicaciones sólo con fecha, ruta y sección no da suficiente información para reconocer al INEGI. En `MD-001`, ambos documentos correctos aparecieron entre los candidatos, pero el agente sólo leyó el pasaje de 2025. Esto último requiere seguimiento explícito de subpreguntas, no otra fórmula de BM25.

## Tercer hito: identidad del documento y cobertura explícita

El siguiente cambio atacó esas tres fallas sin añadir otra herramienta. Está en el commit [`6fd8039`, “improve agent retrieval coverage”](https://github.com/CodeandoGuadalajara/dof-rag/commit/6fd80399da45a18d2c6e5cbbbd1eb224a8f22b53).

Primero, `list_publications` ahora devuelve dos campos informativos: `title` e `institution`. Se extraen del encabezado Markdown cuando existen y, para documentos antiguos sin encabezados, de los primeros bloques en negritas o líneas de texto. Son metadatos de presentación obtenidos bajo demanda, no filtros nuevos: seguimos sin afirmar que toda la colección tiene una institución normalizada.

La diferencia se ve en dos publicaciones del 9 de enero de 2026:

```text
652586  INSTITUTO NACIONAL DE ESTADISTICA Y GEOGRAFIA
        ÍNDICE nacional de precios al consumidor

652600  Secretaría de Seguridad y Protección Ciudadana
        PUBLICACIÓN DE SANCIÓN
```

Antes, ambas entradas llegaban como fecha, ruta, sección e ID. La segunda menciona UMA dentro de una multa y BM25 la colocaba arriba para la consulta `INPC UMA INEGI`. Mostrar la identidad del documento permite distinguir una publicación del INEGI de otra que sólo contiene una coincidencia incidental.

Además añadimos expansiones controladas para tres abreviaturas de esta pregunta: `INEGI`, `INPC` y `UMA`. No son sinónimos generados por el modelo; forman parte del código y siempre producen los mismos términos. Con la fecha fijada al 9 de enero, el documento `652586` pasó al primer lugar.

## Una coincidencia en el título no vale lo mismo que una cita en el cuerpo

El segundo cambio trata identificadores como `NOM-035-STPS-2018`. La búsqueda de cuerpo encuentra tanto la norma como acuerdos, convocatorias y otras publicaciones que la citan. En la primera corrida, una de esas referencias quedó arriba de la fuente emisora.

El nuevo recorrido conserva los candidatos BM25 y añade una búsqueda de frase por el identificador normativo. Después aplica un aumento de puntaje si el identificador aparece en el título, con un aumento adicional cuando el título comienza con “Norma Oficial Mexicana”. El resultado expone `title_boost` junto con el puntaje BM25 original; el cambio de orden no queda oculto dentro de una sola cifra.

Por ejemplo, para `NOM-035-STPS-2018` la fuente `500086` ahora aparece primero:

```text
document_id: 500086
title: NORMA Oficial Mexicana NOM-035-STPS-2018,
       Factores de riesgo psicosocial en el trabajo...
```

Una pregunta que sólo dice `NOM-035` sigue siendo ambigua: existen normas con ese número en trabajo, transporte y pesca. En ese caso no fingimos que el número basta. Los títulos de las primeras posiciones permiten que el modelo elija la norma laboral por el resto de la pregunta.

## Cobertura antes del cierre

Encontrar dos documentos no garantiza que el modelo lea los dos. Por eso el estado de la ejecución ahora conserva requisitos de cobertura que pueden verificarse después de `read_chunks`.

En una comparación que contiene dos años explícitos, la respuesta de la herramienta incluye un mapa como éste:

```json
{
  "coverage": {
    "2025": true,
    "2026": false
  }
}
```

El año se considera cubierto cuando el agente leyó un chunk de un documento cuyo título corresponde a ese año. Mientras quede un valor falso, las herramientas de búsqueda y lectura siguen disponibles y el orquestador rechaza un intento prematuro de respuesta final. La corrida termina de forma normal cuando ambos valores son verdaderos; si agota el límite, la traza queda marcada como cobertura incompleta.

Las referencias cruzadas usan el mismo mecanismo con requisitos distintos. En `CR-001` se registran `transitorio` y `numeral 5.2`. Leer el segundo transitorio sólo cubre el primero. Para cubrir el segundo debe aparecer en un chunk una disposición que comience con `5.2`, no una oración que simplemente cite ese número. El ranking local de chunks también favorece ese encabezado exacto.

Este seguimiento no es una descomposición general de cualquier pregunta. Por ahora reconoce comparaciones con varios años y referencias desde transitorios hacia numerales. Es suficiente para hacer comprobables los dos patrones observados sin pedirle al modelo que se califique a sí mismo. El presupuesto subió de seis a siete turnos para permitir la búsqueda, lectura y cierre de una referencia cruzada; el máximo sigue siendo ocho llamadas a herramientas.

## Segunda corrida sobre las mismas siete preguntas

Repetimos la muestra congelada con Kimi K2.7 Code, BM25 y el mismo corte de datos. No usamos el índice vectorial. La traza quedó fuera del repositorio porque contiene resultados generados, pero se produjo con el runner versionado y este comando:

```bash
.venv/bin/python scripts/eval_v4_agent.py \
  --provider kimi-code \
  --model kimi-for-coding \
  --output eval/cache/eval_v4_agent_smoke_kimi_k27_v4.json
```

| Métrica                              | Primera corrida | Segunda corrida |
| ------------------------------------ | --------------: | --------------: |
| Ejecuciones con cierre válido        |             7/7 |             7/7 |
| Precisión de citas                   |           0.429 |           0.857 |
| Recall de citas                      |           0.357 |           0.857 |
| Corrección de premisa falsa (`n=1`)  |           1.000 |           1.000 |
| Cobertura de requisitos              |   no registrada |           1.000 |
| Llamadas a herramientas por pregunta |            3.14 |            3.43 |
| Turnos del modelo por pregunta       |            4.71 |            4.43 |
| Errores de herramientas              |               1 |               0 |
| Latencia promedio                    |          78.6 s |          41.0 s |
| Tokens de entrada                    |         155,356 |         163,886 |
| Tokens de salida                     |          14,997 |           9,786 |
| Tokens totales                       |         170,353 |         173,672 |

La latencia bajó, pero una muestra de siete llamadas a un servicio remoto no permite atribuir esa diferencia al código. Los cambios que sí podemos inspeccionar están en las trazas y las citas.

`CR-001` leyó el chunk `4733287` con los transitorios y el `4733254` con la obligación del numeral 5.2: identificar y analizar factores de riesgo psicosocial en centros con entre 16 y 50 trabajadores. `MO-001` seleccionó el documento `652586` y citó los chunks `6658934` y `6658935`, que contienen el INPC y los tres valores de UMA. `MD-001` citó `6389054` para 2025 y `6632609` para 2026; el mapa de cobertura terminó con ambos años en `true`.

La revisión manual de esta segunda corrida dio seis respuestas correctas y una parcial:

| Pregunta | Evaluación | Qué ocurrió                                                                                  |
| -------- | ---------- | -------------------------------------------------------------------------------------------- |
| `CR-001` | Correcta   | Siguió la referencia del transitorio al numeral 5.2 y citó ambos pasajes.                    |
| `MO-001` | Correcta   | Recuperó en una sola publicación el INPC mensual, el quincenal y los valores de UMA.         |
| `MD-001` | Correcta   | Comparó 2025 y 2026 con un chunk de cada resolución.                                         |
| `NE-001` | Correcta   | Comprobó que el decreto no contiene el supuesto artículo 99.                                 |
| `SP-001` | Correcta   | Respondió 315.04 y 440.87 pesos con el chunk anotado.                                        |
| `TE-001` | Correcta   | Recuperó las fechas de la regla general y de las obligaciones diferidas.                     |
| `LI-001` | Parcial    | Contestó el rango de más de 50, pero cerró sin cubrir por completo hasta 15 y entre 16 y 50. |

La precisión y el recall automáticos de 0.857 reflejan el mismo patrón: seis preguntas citaron exactamente los chunks anotados y `LI-001` no. La métrica no sustituye la lectura de las respuestas, pero en esta muestra dejó de ocultar las fallas que motivaron el cambio.

## Qué sigue

Los tres problemas que bloqueaban la muestra pequeña ya tienen una corrección medible. El siguiente paso razonable es ejecutar las 42 preguntas de v4 con esta configuración, conservar la revisión por categoría y medir cuánto se generalizan las reglas de cobertura. `LI-001` indica una extensión concreta: representar rangos o elementos enumerados como requisitos separados, en vez de asumir que un solo chunk cubre toda una lista.

Después podremos comparar BM25 con búsqueda híbrida cuando la cobertura del índice vectorial sea suficiente y esté registrada en cada corrida. La comparación debe mantener iguales las preguntas, límites, modelo y reglas de cierre; de otro modo no sabremos si una diferencia provino del retrieval o de una trayectoria más larga.

Kimi K2.7 Code sigue siendo aquí una conexión funcional y una línea base, no una clasificación general de modelos para investigación jurídica. La mejora importante de este hito no es que el agente haga más cosas: es que ahora podemos ver qué documento eligió, por qué cambió su orden y qué parte de la pregunta todavía no tiene evidencia.
