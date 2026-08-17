---
title: 'De encontrar documentos a encontrar evidencia: herramientas para consultar el DOF'
description: 'Cómo separamos la búsqueda documental de la recuperación de evidencia y construimos un bucle acotado, trazable y evaluable para consultar el DOF.'
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

## El problema no era solamente buscar

La evaluación v4 nos mostró una diferencia importante: encontrar la publicación correcta no implica encontrar el pasaje que permite responder. Una consulta puede recuperar el decreto adecuado y, sin embargo, entregar al modelo el artículo equivocado, un transitorio incompleto o una tabla que sólo contiene la mitad de los datos.

En el DOF hay dos problemas de recuperación distintos:

1. descubrir cuáles publicaciones son candidatas entre cientos de miles;
2. localizar, dentro de esas publicaciones, los fragmentos que sostienen la respuesta.

El [PR #67 de `dof-rag`](https://github.com/CodeandoGuadalajara/dof-rag/pull/67) construye una primera solución para ambos problemas. La idea central es separar la recuperación de la generación: antes de pedirle a un modelo que redacte una respuesta, le damos operaciones pequeñas, deterministas y verificables para que pueda encontrar y leer evidencia.

Esto también separa las fallas. Si una respuesta es incorrecta, podemos preguntar si el buscador no encontró la fuente, si el agente no leyó el pasaje correcto o si el modelo interpretó mal una evidencia que sí tenía.

## Cinco operaciones, con contratos claros

Una herramienta es una función con entradas y salidas definidas. No es una capacidad vaga del modelo: recibe argumentos validados y devuelve resultados reproducibles mientras no cambien los índices.

El primer conjunto tiene cinco operaciones:

| Herramienta                                      | Función                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `list_publications(filters)`                     | Lista publicaciones por fecha, sección y corte temporal.                   |
| `search_documents(query, strategy, filters)`     | Encuentra documentos candidatos con BM25, vectores o búsqueda híbrida.     |
| `search_evidence(query, document_ids, strategy)` | Busca chunks sólo dentro de documentos ya descubiertos.                    |
| `get_document_outline(document_id)`              | Muestra encabezados, tamaños e índice de chunks para navegar un documento. |
| `read_chunks(chunk_ids, neighbor_window)`        | Lee el texto final y, si hace falta, sus chunks vecinos.                   |

La diferencia entre las dos búsquedas es crucial. `search_documents` responde “¿qué publicación debería revisar?”. `search_evidence` responde “¿qué pasaje de esas publicaciones contiene la respuesta?”. La segunda no vuelve a buscar en los 6.73 millones de chunks: trabaja sobre el conjunto acotado de candidatos.

El contrato admite estrategias `lexical`, `vector` e `hybrid`, pero las corridas descritas en este artículo usaron únicamente búsqueda lexical. El índice vectorial seguía incompleto; mezclarlo habría confundido la calidad del método con la cobertura disponible del índice.

Los contratos también hacen explícitas las limitaciones. Hoy podemos filtrar de manera confiable por fecha, intervalo de fechas y sección matutina, vespertina o extraordinaria. Todavía no ofrecemos filtros generales por institución o tipo de documento porque esa metadata no está normalizada para todo el corpus. La herramienta rechaza un filtro que no puede cumplir en vez de simular que lo aplicó.

## Un ejemplo: los salarios mínimos de 2026

Consideremos esta pregunta de v4:

> ¿Cuáles son los salarios mínimos generales diarios que rigen en 2026 para la zona general y la frontera norte?

Primero descubrimos la publicación:

```text
search_documents(
  query="salarios mínimos generales diarios 2026 zona general frontera norte",
  strategy="lexical",
  filters={"as_of": "2026-04-24"},
  top_k=20
)
```

El documento `651143`, una resolución de la CONASAMI publicada el 9 de diciembre de 2025, aparece como candidato. Eso todavía no es evidencia: sólo nos dice dónde continuar.

Después buscamos dentro de esos documentos:

```text
search_evidence(
  query="salarios mínimos generales diarios 2026 zona general frontera norte",
  document_ids=[651143, ...],
  strategy="lexical",
  top_k=20
)
```

El chunk `6632609` contiene los dos valores: 315.04 pesos diarios para la zona general y 440.87 para la Zona Libre de la Frontera Norte. Antes de responder podemos leer el chunk y sus vecinos:

```text
read_chunks(chunk_ids=[6632609], neighbor_window=1)
```

Los vecinos ayudan cuando un encabezado, una fecha o una condición quedó justo en el límite entre dos chunks. También dejan una procedencia concreta para la cita.

## Por qué BM25 y no una sola puntuación casera

El prototipo ordenaba los chunks por coincidencias de palabras y favorecía, además, a los fragmentos largos. Eso podía hacer que dos textos con las mismas coincidencias quedaran en un orden distinto sólo por su tamaño.

La búsqueda interna usa ahora BM25. El método recompensa términos frecuentes dentro de un fragmento, reduce el peso de palabras que aparecen en casi todos los fragmentos y normaliza la longitud. En esta etapa basta con aplicarlo al conjunto pequeño de chunks de los documentos candidatos. Más adelante podremos reemplazarlo por FTS5 o por un reranker sin cambiar el contrato de `search_evidence`.

También añadimos señales estructurales donde la coincidencia literal no alcanza:

- los identificadores normativos completos, como `NOM-035-STPS-2018`, reciben prioridad cuando aparecen en el título de la fuente emisora;
- los encabezados exactos como `8.5` superan a un párrafo que sólo menciona ese número;
- nombres explícitos como “Ley General de Aguas” o “Plan Nacional de Desarrollo 2025-2030” pueden buscarse en títulos y rutas de encabezados;
- para consultas como `INEGI INPC UMA`, la lista de publicaciones muestra título e institución para distinguir al INEGI de una publicación que sólo menciona la UMA dentro de una multa.

Estas son reglas deterministas, no sinónimos inventados por el modelo. Su propósito es corregir fallas observables sin esconder el motivo del cambio: los resultados conservan el BM25 original y muestran, por separado, el `title_boost` aplicado.

## La evidencia debe poder verificarse

Un chunk no se entrega directamente desde un archivo de texto cualquiera. Se reconstruye desde el corpus comprimido usando su receta de offsets; antes de devolverlo, la herramienta calcula su hash y lo compara con el registrado durante el chunking. Si el contenido cambió, la lectura falla.

La capa de respuesta aplica otra regla: sólo se puede citar un chunk que el agente haya recibido mediante `read_chunks`. Que un ID aparezca en `search_evidence` sirve para decidir qué leer, pero no autoriza todavía una cita. Así evitamos que el modelo presente como consultada una fuente que nunca vio.

Esto no prueba por sí solo que la cita sostenga la afirmación. Sí garantiza procedencia básica y permite que una evaluación posterior revise la relación entre afirmación y pasaje. Cada corrida registra también la versión del corpus, del chunker y de los índices; sin esas versiones no sabríamos si un cambio provino del código o de los datos.

## El agente decide el recorrido y redacta la respuesta

Con las herramientas listas construimos un bucle pequeño de llamadas, no un marco general de agentes. En cada turno el modelo hace una de dos cosas: solicita una herramienta con argumentos estructurados o entrega la respuesta final.

```text
pregunta
   ↓
modelo ── solicita herramienta ──→ validador ──→ DOF-RAG/SQLite
   ↑                                      │
   └──────── resultado + call_id ─────────┘
   │
   └── respuesta JSON → validación de citas
```

El recorrido tiene estados: descubrir documentos, descubrir evidencia, leer chunks y responder. El modelo sólo ve las operaciones válidas para el estado actual. Hay límites independientes de seis a ocho turnos, según la versión evaluada, y como máximo ocho llamadas a herramientas. Si una pregunta exige más trabajo, la ejecución queda incompleta en vez de buscar indefinidamente.

Las herramientas se describen con esquemas estrictos. Por ejemplo, `read_chunks` exige entre uno y ocho enteros, un `neighbor_window` entre cero y uno y ningún campo adicional:

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
      "neighbor_window": { "type": "integer", "minimum": 0, "maximum": 1 }
    },
    "required": ["chunk_ids", "neighbor_window"],
    "additionalProperties": false
  }
}
```

El servidor vuelve a validar todo antes de consultar las bases. Una fecha posterior al corte, un documento que el agente nunca descubrió o un chunk que nunca fue leído producen un error estructurado. La traza conserva el turno, los argumentos, el resultado, el tiempo y el `call_id`; por eso una ejecución se puede inspeccionar sin adivinar qué ocurrió a partir de la respuesta final.

## No basta con cerrar en JSON

Las primeras corridas revelaron una trampa: una respuesta puede cumplir el esquema JSON y seguir sin tener evidencia suficiente. Por eso el runner evolucionó en tres contratos generales.

Primero, una respuesta final debe contener al menos una cita válida después de eliminar IDs no leídos. Leer evidencia pero devolver `citations: []` ya no cuenta como cierre.

Segundo, las preguntas que exigen varios documentos tienen requisitos de cobertura. Una comparación entre 2025 y 2026 debe leer evidencia de ambos años; una pregunta que sigue una referencia desde un transitorio hasta el numeral 5.2 debe cubrir ambos saltos. En una pregunta de lista, “hasta 15”, “entre 16 y 50” y “más de 50” son tres requisitos, no una sola etiqueta de lista.

Tercero, una premisa falsa no se valida sólo porque el agente no encontró coincidencias. Debe citar evidencia, cubrir las anclas relevantes y formular una corrección afirmativa. El código puede verificar procedencia y cobertura, pero si el pasaje realmente demuestra la corrección sigue requiriendo revisión humana.

La idea es importante: el agente no se califica a sí mismo. El runner comprueba condiciones observables de la trayectoria y deja explícita la parte semántica que todavía necesita un juez humano.

## Qué aprendimos de las evaluaciones

La evaluación separa las mismas dos etapas que las herramientas. Primero medimos si BM25 encontraba las publicaciones de referencia entre todo el corpus:

| Métrica documental                           |  BM25 |
| -------------------------------------------- | ----: |
| MRR del primer documento correcto            | 0.221 |
| Recall documental@5                          | 0.381 |
| Recall documental@10                         | 0.429 |
| Preguntas con todos sus documentos en top-10 | 0.405 |

El recall documental@10 de 0.429 significa que, en promedio, más de la mitad de los documentos de referencia quedó fuera de las primeras diez posiciones. La última fila es todavía más estricta: en preguntas con varios saltos, exige que todos los documentos necesarios aparezcan en el top-10.

Después, sin cambiar esa selección inicial de documentos, comparamos cómo se ordenaban los chunks dentro de los candidatos:

| Métrica                           | Prototipo | Herramientas nuevas |
| --------------------------------- | --------: | ------------------: |
| MRR del primer chunk de evidencia |     0.092 |               0.104 |
| Recall de evidencia@1             |     0.060 |               0.048 |
| Recall de evidencia@5             |     0.083 |               0.167 |
| Recall de evidencia@10            |     0.155 |               0.187 |

La lectura de esta segunda tabla es mixta. La cobertura entre las primeras cinco posiciones se duplicó, pero el primer resultado empeoró ligeramente y el MRR apenas subió. En términos absolutos, ambos sistemas siguen recuperando poca evidencia: son líneas base de investigación, no resultados suficientes para un producto. La etapa documental no cambió entre el prototipo y las herramientas porque esa comparación modificó principalmente el ordenamiento posterior de chunks.

Los dos MRR tampoco deben compararse entre sí como si midieran lo mismo. Uno ordena publicaciones y el otro, chunks dentro de un conjunto de candidatos. En ambos casos MRR sólo considera la posición del primer resultado correcto. Una lista, una comparación entre años o una referencia cruzada puede encontrar un pasaje temprano y aun así omitir los demás. Por eso lo acompañamos con recall, cobertura de todos los documentos, requisitos explícitos y revisión de la respuesta final.

Después probamos el bucle con siete preguntas representativas usando Kimi K2.7 Code. La primera versión logró cierres válidos en 7/7, pero la revisión manual encontró sólo dos respuestas correctas, dos parciales y tres no resueltas. Había problemas concretos: confundía normas con el mismo número, elegía una publicación equivocada del mismo día y leía sólo uno de los dos documentos de una comparación.

Sobre esas mismas preguntas, la incorporación de identidad documental, cobertura explícita y fragmentos centrados en la consulta produjo una segunda corrida de 7/7 cierres válidos, con seis respuestas correctas y una parcial. En la corrida completa de 42 preguntas, desde `ba4e954`, hubo 41/42 cierres válidos; la revisión humana clasificó 35 respuestas como correctas, tres parciales y cuatro incorrectas o no resueltas. Las categorías de listas y referencias cruzadas mejoraron, pero las preguntas multidocumento siguieron siendo el cuello de botella.

La última prueba fue deliberadamente focalizada: siete casos que habían fallado. Con los contratos nuevos hubo 5/7 cierres válidos. Eso puede parecer peor que 41/42, pero no es una contradicción: eran precisamente los casos difíciles, y el sistema dejó de contar como “completadas” varias respuestas parciales o sustentadas por una fuente equivocada. Dos ejemplos muestran el valor de esa decisión:

- `MD-002` ahora leyó y citó los documentos de 2025 y 2026, incluidos los tres valores y sus incrementos;
- `MD-004` no alcanzó a reconstruir toda la secuencia y terminó como incompleta, en vez de entregar una respuesta con sólo una parte de la evidencia.

Los números de citas deben leerse con cuidado. v4 compara contra chunks anotados y puede penalizar un pasaje alternativo que sí sea válido. En una prueba, el agente respondió correctamente una lista pero citó un chunk equivalente que no estaba en el conjunto gold. Por eso el recall automático es una señal útil de procedencia, no una prueba definitiva de corrección sustantiva.

Además, la precisión y el recall de citas del runner se calculan sólo sobre las ejecuciones que alcanzaron un cierre válido. La tasa de cierres se reporta por separado para no convertir una ejecución incompleta en un dato ausente.

Hay una limitación metodológica mayor. Las fallas de v4 sirvieron para diseñar varias de las reglas posteriores: abreviaturas institucionales, identificadores normativos, periodos, listas y requisitos multidocumento. En consecuencia, v4 se convirtió de hecho en nuestro conjunto de desarrollo. Los resultados muestran que las correcciones resolvieron casos observados y que el sistema puede detectar más cierres incompletos; no demuestran todavía que las reglas se generalicen a preguntas nuevas.

## Qué sigue

El trabajo de este PR no convierte al DOF en un sistema que responde cualquier pregunta. Hace algo más básico y necesario: vuelve visible el camino entre una pregunta, los documentos candidatos, la evidencia leída y la cita final.

V4 seguirá siendo útil como prueba de regresión: el siguiente paso inmediato es repetir sus 42 preguntas con los contratos de cierre, documentos y premisas falsas. El siguiente resultado que puede demostrar generalización, sin embargo, necesita un conjunto nuevo y bloqueado. Debemos escribir y anotar esas preguntas antes de ejecutar el sistema, congelar el código y evitar añadir reglas después de ver los resultados.

Después podremos comparar BM25 con búsqueda híbrida cuando el índice vectorial tenga una cobertura exacta y reportable. La comparación deberá mantener constantes las preguntas, los límites, el modelo y las reglas de cierre.

También quedan dos extensiones claras: representar mejor las subpreguntas de consultas multidocumento y registrar evidencia alternativa en v4. Ambas surgen de fallas visibles en las trazas y pueden investigarse manteniendo fijo el modelo. El objetivo del siguiente corte no es conseguir una cifra alta a cualquier costo, sino saber qué encontró el sistema, qué leyó, qué todavía no puede sostener y si esas decisiones se repiten fuera del conjunto con el que las diseñamos.
