---
title: 'De encontrar documentos a encontrar evidencia: cinco herramientas para consultar el DOF'
description: 'Cómo separamos la búsqueda documental de la recuperación de pasajes y construimos cinco herramientas deterministas, trazables y evaluables sobre el DOF.'
date: '2026-08-13'
heroImage: ''
category: 'desarrollo'
tags:
  ['dof-rag', 'retrieval', 'bm25', 'herramientas', 'evaluacion', 'evidencia']
author: 'Joaquín Bravo Contreras'
---

## El problema no era solamente buscar

La evaluación v4 nos mostró una diferencia importante: encontrar la publicación correcta no implica encontrar el pasaje que permite responder. Una consulta puede recuperar el decreto adecuado y, sin embargo, entregar el artículo equivocado, un transitorio incompleto o una tabla que sólo contiene la mitad de los datos.

En el DOF hay dos problemas de recuperación distintos:

1. descubrir cuáles publicaciones son candidatas entre cientos de miles;
2. localizar, dentro de esas publicaciones, los fragmentos que sostienen la respuesta.

El [PR #67 de `dof-rag`](https://github.com/CodeandoGuadalajara/dof-rag/pull/67) construye una primera solución para ambos problemas. Antes de pedirle a un modelo que redacte una respuesta, le damos operaciones pequeñas, deterministas y verificables para encontrar y leer evidencia.

Esta separación también permite diagnosticar las fallas. Si una respuesta es incorrecta, podemos preguntar si el buscador no encontró la publicación, si el pasaje quedó fuera de los primeros resultados o si el modelo interpretó mal una evidencia que sí recibió.

## Cinco operaciones, con contratos claros

Una herramienta es una función con entradas y salidas definidas. Recibe argumentos validados y devuelve resultados reproducibles mientras no cambien los índices.

El primer conjunto tiene cinco operaciones:

| Herramienta                                      | Función                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `list_publications(filters)`                     | Lista publicaciones por fecha, sección y corte temporal.                   |
| `search_documents(query, strategy, filters)`     | Encuentra documentos candidatos con BM25, vectores o búsqueda híbrida.     |
| `search_evidence(query, document_ids, strategy)` | Busca chunks sólo dentro de documentos ya descubiertos.                    |
| `get_document_outline(document_id)`              | Muestra encabezados, tamaños e índice de chunks para navegar un documento. |
| `read_chunks(chunk_ids, neighbor_window)`        | Lee el texto final y, si hace falta, sus chunks vecinos.                   |

La diferencia entre las dos búsquedas es crucial. `search_documents` responde “¿qué publicación debería revisar?”. `search_evidence` responde “¿qué pasaje de esas publicaciones contiene la respuesta?”. La segunda no vuelve a buscar en los 6.73 millones de chunks: trabaja sobre el conjunto acotado de candidatos.

El contrato admite estrategias `lexical`, `vector` e `hybrid`, pero las corridas descritas aquí usaron únicamente búsqueda lexical. El índice vectorial seguía incompleto; mezclarlo habría confundido la calidad del método con la cobertura disponible del índice.

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

## Por qué BM25 y no una puntuación casera

El prototipo ordenaba los chunks por coincidencias de palabras y favorecía, además, a los fragmentos largos. Dos textos con las mismas coincidencias podían quedar en un orden distinto sólo por su tamaño.

La búsqueda interna usa ahora BM25. El método recompensa términos frecuentes dentro de un fragmento, reduce el peso de palabras que aparecen en casi todos los fragmentos y normaliza la longitud. En esta etapa basta con aplicarlo al conjunto pequeño de chunks de los documentos candidatos. Más adelante podremos reemplazarlo por FTS5 o por un reranker sin cambiar el contrato de `search_evidence`.

Las corridas posteriores revelaron casos donde la coincidencia literal tampoco era suficiente. Añadimos entonces señales estructurales que se pueden inspeccionar:

- los identificadores completos, como `NOM-035-STPS-2018`, reciben prioridad cuando aparecen en el título de la fuente emisora;
- los encabezados exactos como `8.5` superan a un párrafo que sólo menciona ese número;
- nombres como “Ley General de Aguas” o “Plan Nacional de Desarrollo 2025-2030” pueden buscarse en títulos y rutas de encabezados;
- para consultas como `INEGI INPC UMA`, la lista de publicaciones muestra título e institución para distinguir al INEGI de una publicación que sólo menciona la UMA dentro de una multa.

Estas reglas son deterministas. Los resultados conservan el puntaje BM25 y muestran por separado cualquier aumento aplicado al título; así podemos saber por qué cambió el orden.

## La evidencia debe poder verificarse

Un chunk no se entrega directamente desde un archivo de texto cualquiera. Se reconstruye desde el corpus comprimido usando su receta de offsets; antes de devolverlo, la herramienta calcula su hash y lo compara con el registrado durante el chunking. Si el contenido cambió, la lectura falla.

La capa de respuesta aplica otra regla: sólo se puede citar un chunk obtenido mediante `read_chunks`. Que un ID aparezca en `search_evidence` sirve para decidir qué leer, pero no autoriza todavía una cita. Así evitamos que un modelo presente como consultada una fuente que nunca vio.

Esto no prueba por sí solo que la cita sostenga la afirmación. Sí garantiza procedencia básica y permite que una evaluación posterior revise la relación entre afirmación y pasaje. Cada corrida registra también la versión del corpus, del chunker y de los índices.

## Qué dicen los primeros números

La evaluación separa las mismas dos etapas que las herramientas. Primero medimos si BM25 encontraba las publicaciones de referencia entre todo el corpus:

| Métrica documental                           |  BM25 |
| -------------------------------------------- | ----: |
| MRR del primer documento correcto            | 0.221 |
| Recall documental@5                          | 0.381 |
| Recall documental@10                         | 0.429 |
| Preguntas con todos sus documentos en top-10 | 0.405 |

El recall documental@10 de 0.429 significa que, en promedio, más de la mitad de los documentos de referencia quedó fuera de las primeras diez posiciones. La última fila es todavía más estricta: en preguntas con varios saltos exige que todos los documentos necesarios aparezcan en el top-10.

Después, sin cambiar esa selección inicial de documentos, comparamos cómo se ordenaban los chunks dentro de los candidatos:

| Métrica                           | Prototipo | Herramientas nuevas |
| --------------------------------- | --------: | ------------------: |
| MRR del primer chunk de evidencia |     0.092 |               0.104 |
| Recall de evidencia@1             |     0.060 |               0.048 |
| Recall de evidencia@5             |     0.083 |               0.167 |
| Recall de evidencia@10            |     0.155 |               0.187 |

La lectura es mixta. La cobertura entre las primeras cinco posiciones se duplicó, pero el primer resultado empeoró ligeramente y el MRR apenas subió. En términos absolutos, ambos sistemas siguen recuperando poca evidencia: son líneas base de investigación, no resultados suficientes para un producto.

Los dos MRR no miden lo mismo. Uno ordena publicaciones y el otro, chunks dentro de un conjunto de candidatos. Además, MRR sólo considera la posición del primer resultado correcto. Una lista, una comparación entre años o una referencia cruzada puede encontrar un pasaje temprano y aun así omitir los demás. Para esas preguntas también necesitamos medir cobertura de todos los documentos y de cada parte de la respuesta.

Ese requisito nos llevó al siguiente experimento. En [el segundo artículo](/es/blog/2026/08/agente-dof-evidencia-cobertura/) conectamos estas herramientas a un modelo, seguimos sus decisiones y comprobamos qué ocurre cuando encontrar un pasaje no basta para contestar toda la pregunta.
