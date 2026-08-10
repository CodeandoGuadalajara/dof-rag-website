---
title: 'Eval v4: encontrar el documento no basta; también hay que encontrar la evidencia'
description: 'Construimos una evaluación manual de 42 preguntas para medir listas completas, vigencias, referencias jurídicas, consultas multidocumento, monitoreo y premisas falsas. La corrimos contra BM25 completo y un índice vectorial al 38.2% para fijar una línea base antes de terminar los embeddings.'
date: '2026-08-09'
heroImage: ''
category: 'desarrollo'
tags:
  [
    'dof-rag',
    'evaluacion',
    'retrieval',
    'bm25',
    'vector-search',
    'busqueda-hibrida',
    'rag',
  ]
author: 'Joaquín Bravo Contreras'
---

## La pregunta que la evaluación anterior no podía responder

La [evaluación v3](/es/blog/2026/08/eval-bm25-corpus-completo/) nos sirvió para corregir dos problemas importantes: títulos que en realidad eran nombres de archivo y consultas demasiado ambiguas para distinguir una publicación entre miles de documentos parecidos. Con 3,013 consultas y 499 documentos de referencia, sigue siendo útil para comparar cambios en el buscador.

Pero v3 mide una tarea bastante limitada: dada una consulta, ¿en qué posición aparece **un documento conocido**? No distingue entre estos dos resultados:

1. el sistema recuperó el documento correcto y también el párrafo que contiene la respuesta;
2. recuperó el documento correcto, pero entregó un fragmento irrelevante de ese mismo documento.

Para una persona que consulta el Diario Oficial, la diferencia es fundamental. Un decreto puede tener cien páginas. Saber que la respuesta “está en ese decreto” no basta si el sistema no localiza el artículo, transitorio o tabla que la sostiene.

Tampoco todas las preguntas tienen un solo documento correcto. Para explicar cómo cambió el salario mínimo de 2025 a 2026 hacen falta dos resoluciones. Para reconstruir una expropiación pueden hacer falta la primera declaratoria, la segunda publicación y el decreto final. Si el buscador encuentra uno de tres documentos, tuvo un acierto parcial; si encuentra los tres, completó la tarea.

Por eso construimos **eval v4**, una muestra pequeña y revisada a mano que cambia la unidad de evaluación: ya no solo registra el documento esperado, sino también los chunks y las citas exactas que permiten contestar.

## Qué contiene v4

V4 tiene 42 preguntas en español: seis preguntas en cada una de siete categorías. No pretende sustituir las 3,013 consultas de v3. Cumple otra función: probar tipos de consulta más cercanos al trabajo real de una persona que busca información jurídica o administrativa.

| Categoría               | Ejemplo                                                                                  | Qué exige del buscador                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Pasaje único            | ¿Cuáles son los salarios mínimos diarios de 2026 en la zona general y la frontera norte? | Encontrar un dato o definición en un pasaje concreto.                       |
| Lista completa          | ¿Cuáles son los siete objetos del artículo 3 de la Ley General de Aguas?                 | Recuperar todos los elementos, no solo uno o dos.                           |
| Temporal y transitorios | ¿Cuándo entraron en vigor las dos fases de la NOM-035?                                   | Interpretar publicación, vigencia y obligaciones diferidas.                 |
| Referencia cruzada      | ¿Qué exigen los numerales 8.3, 8.4 y 8.5 citados por el transitorio de la NOM-035?       | Ir de una referencia jurídica a su contenido.                               |
| Múltiples documentos    | ¿Cómo cambiaron los salarios mínimos generales de 2025 a 2026?                           | Combinar evidencia de dos o más publicaciones.                              |
| Monitoreo               | ¿Qué publicó el INEGI en el DOF del 9 de enero de 2026?                                  | Usar fecha, institución y tipo de publicación como filtros implícitos.      |
| Premisa falsa           | ¿Cuándo quedó abrogada por completo la Ley de Aguas Nacionales en diciembre de 2025?     | Detectar que la pregunta parte de un dato falso y corregirlo con evidencia. |

La última categoría merece una explicación. El decreto del 11 de diciembre de 2025 expidió la Ley General de Aguas y reformó, adicionó y derogó disposiciones de la Ley de Aguas Nacionales. No abrogó por completo esta última. Un sistema que intenta complacer la pregunta puede inventar una fecha de abrogación; uno que consulta bien el corpus debe señalar el error antes de responder.

Cada registro de v4 contiene:

- la pregunta y una respuesta de referencia;
- una persona o contexto de uso, como recursos humanos, tesorería, periodismo o práctica jurídica;
- dificultad y fecha de corte (`as_of`);
- indicación de si la pregunta se puede contestar o parte de una premisa falsa;
- número de saltos documentales requeridos;
- identificadores y rutas de los documentos correctos;
- identificadores de chunk;
- citas textuales que sostienen la respuesta.

El corpus también queda congelado por versión: `dof-full-v1`, con 657,867 documentos publicados entre el 4 de enero de 1999 y el 24 de abril de 2026. El chunker se fija como `dof-chunker-v1`. Esto evita comparar dos corridas que, sin decirlo, usaron textos o cortes distintos.

## Las citas no son decoración

La primera versión de los registros tenía citas legibles, pero algunas juntaban dos oraciones separadas omitiendo palabras intermedias. Para una explicación humana eso puede ser aceptable; como evidencia de referencia, no.

Construimos un validador determinista que vuelve a generar cada chunk desde el Markdown original y comprueba que la cita normalizada sea una secuencia contigua dentro de él. También verifica:

1. que existan exactamente 42 preguntas y seis por categoría;
2. que no haya identificadores ni preguntas duplicadas;
3. que la versión, el tamaño y las fechas del corpus coincidan;
4. que documento, ruta, fecha y sección correspondan en la base;
5. que chunk, documento, índice y versiones correspondan entre sí;
6. que las preguntas multidocumento tengan al menos dos documentos y dos saltos;
7. que las preguntas con premisa falsa incluyan una corrección respaldada.

La validación final quedó en **42 preguntas, 14 documentos y 31 chunks de evidencia distintos**. Que solo haya 14 documentos es una limitación deliberada de esta primera versión: preferimos una muestra pequeña que pudiéramos auditar completa antes de ampliar la cobertura temática.

## Cómo medimos una respuesta con varios documentos

MRR sigue siendo útil, pero ya no alcanza por sí solo.

### MRR: qué tan pronto aparece la primera fuente útil

MRR significa _Mean Reciprocal Rank_, promedio del inverso de la posición. Si el primer documento correcto aparece en la posición 1, la consulta aporta 1. Si aparece en la posición 2, aporta 0.5; en la posición 10, 0.1. Una consulta sin documento correcto dentro de la profundidad evaluada aporta 0.

Esta métrica premia que al menos una fuente útil aparezca pronto, pero una pregunta multidocumento puede obtener un buen MRR aunque falte la mitad de la respuesta.

### Recall documental: cuánto de la evidencia documental apareció

Supongamos que una comparación requiere las resoluciones salariales de 2025 y 2026. Si el top-10 contiene solo la de 2026, el recall documental es 1/2, o 0.5. Si contiene ambas, es 1.

### All-hop recall: si aparecieron todas las fuentes necesarias

Para la misma pregunta, `all-hop@10` vale 1 únicamente si las dos resoluciones aparecen en los primeros diez resultados. Encontrar una de dos vale 0. Es una métrica más estricta, pero corresponde mejor a una respuesta que necesita completar varios pasos.

### Recall de chunks de evidencia: si apareció el pasaje correcto

La búsqueda vectorial devuelve chunks, así que también medimos cuántos chunks de referencia aparecen en los primeros 1, 5, 10 y 20 resultados. Esta es la prueba que separa “encontré el decreto” de “encontré el párrafo que contesta”.

## Tres buscadores sobre dos índices en distinto estado

Corrimos v4 contra los componentes que existen hoy:

- **BM25 documental completo** sobre los 657,867 documentos. BM25 favorece coincidencias de palabras, sobre todo términos raros, cifras, nombres y referencias.
- **Jina binario parcial**. El embedding original tiene 1,024 números. Para ahorrar espacio guardamos un bit por número: 1 si es positivo, 0 si es negativo. La consulta se representa igual y sqlite-vec ordena por distancia de Hamming, es decir, por cuántos bits difieren entre ambos.
- **Búsqueda híbrida**, que combina las listas de BM25 y vectores. Probamos RRF —que combina posiciones— y tres mezclas ponderadas. `W0.75`, por ejemplo, asigna 75% del peso a BM25 y 25% al componente vectorial después de normalizar los puntajes de cada lista.

El índice vectorial no estaba terminado. Al momento de la corrida contenía **2,574,336 de 6,730,304 chunks: 38.2%**. Como la construcción avanza en orden cronológico, solo dos de los catorce documentos de referencia de v4 estaban incluidos. Esto deja tres preguntas completamente cubiertas por vectores:

- `SP-002`: tipo de cambio obtenido el 9 de agosto de 2006;
- `MD-003`: comparación de tipos de cambio del 8 y 9 de agosto de 2006;
- `MO-002`: publicaciones de Banco de México del 10 de agosto de 2006.

Reportamos dos cortes. El primero usa las 42 preguntas y representa el sistema tal como existe hoy, aunque mezcla calidad con falta de cobertura. El segundo usa solo esas tres preguntas; es justo para el componente vectorial, pero demasiado pequeño para elegir una configuración final.

## Resultado sobre las 42 preguntas

| Sistema           |       MRR | Recall documental@5 | Recall documental@10 | All-hop@10 |
| ----------------- | --------: | ------------------: | -------------------: | ---------: |
| Híbrido W0.75     | **0.237** |               0.381 |                0.429 |      0.405 |
| BM25              |     0.221 |               0.381 |                0.429 |      0.405 |
| Híbrido W0.5      |     0.118 |               0.167 |                0.381 |      0.357 |
| RRF               |     0.114 |               0.131 |                0.333 |      0.310 |
| Híbrido W0.25     |     0.046 |               0.036 |                0.107 |      0.095 |
| Vectorial parcial |     0.014 |               0.036 |                0.036 |      0.024 |

El resultado vectorial de 0.014 no es una evaluación del modelo Jina: 39 de las 42 preguntas no tienen todos sus documentos en el índice. Es, principalmente, una medición de cobertura incompleta.

La mezcla W0.75 mejora el MRR de BM25 de 0.221 a 0.237, un aumento relativo de 7.2%, pero no cambia el recall. Los vectores disponibles ayudan a reordenar algunos documentos que BM25 ya había recuperado; todavía no pueden aportar cobertura sobre las publicaciones recientes que no están embebidas.

El desglose por categoría muestra dónde está trabajando BM25:

| Categoría               | BM25 MRR | Híbrido W0.75 MRR |
| ----------------------- | -------: | ----------------: |
| Pasaje único            |    0.500 |             0.500 |
| Múltiples documentos    |    0.282 |         **0.391** |
| Temporal y transitorios |    0.255 |             0.252 |
| Premisa falsa           |    0.208 |             0.208 |
| Lista completa          |    0.151 |             0.150 |
| Monitoreo               |    0.097 |             0.102 |
| Referencia cruzada      |    0.056 |             0.053 |

Las preguntas de pasaje único contienen anclas fuertes: un año, una cifra, una institución o un nombre de norma. BM25 responde bien a ese patrón. Las referencias cruzadas son distintas: la pregunta puede mencionar “el numeral 8.5”, mientras el pasaje que necesitamos explica “primer nivel”, “segundo nivel” y “tercer nivel”. Compartir pocos términos vuelve más importante la recuperación semántica y, probablemente, un segundo modelo que vuelva a ordenar con más cuidado una lista corta de candidatos.

## El corte pequeño donde los vectores sí tienen cobertura

| Sistema           |       MRR | Recall documental@10 | All-hop@10 |
| ----------------- | --------: | -------------------: | ---------: |
| RRF               | **0.389** |                0.500 |      0.333 |
| Híbrido W0.5      |     0.364 |                0.167 |      0.000 |
| Híbrido W0.75     |     0.343 |                0.167 |      0.000 |
| Híbrido W0.25     |     0.278 |                0.500 |      0.333 |
| Vectorial parcial |     0.194 |                0.500 |      0.333 |
| BM25              |     0.111 |                0.167 |      0.000 |

Aquí la fusión vuelve a superar a cada componente por separado. Es una señal compatible con las evaluaciones anteriores, no una conclusión: tres preguntas sobre dos publicaciones diarias de Banco de México están muy lejos de representar las siete categorías.

La recuperación del pasaje exacto también queda pendiente. En las tres preguntas cubiertas, el recall promedio de chunks de evidencia fue **0.111 en top-20**, y ninguna recuperó todos sus chunks necesarios dentro de las primeras veinte posiciones. Un chunk correcto apareció en posición 3, otros en 84 y 184. Colapsar chunks a documento puede hacer que el documento correcto suba, pero esos pasajes tan profundos no cabrían en el contexto enviado al modelo generador.

Esto sugiere una separación útil para la arquitectura:

1. recuperar documentos candidatos con BM25 y vectores;
2. buscar más profundamente dentro de esos documentos;
3. rerankear los chunks antes de construir el contexto final.

No hace falta decidir todavía qué modelo hará ese segundo ordenamiento. La evaluación ya define qué tendría que mejorar: recall de evidencia en top-10 o top-20 sin perder all-hop documental.

## Qué podemos concluir y qué no

La corrida establece cuatro cosas:

1. **V4 se puede ejecutar de punta a punta.** Preguntas, documentos, chunks, citas y métricas están conectados a las bases reales, no a una muestra en memoria.
2. **BM25 fija una línea base completa.** MRR 0.221, recall documental@10 de 0.429 y all-hop@10 de 0.405 sobre las 42 preguntas.
3. **La fusión puede mejorar el orden.** W0.75 subió el MRR sin ampliar el conjunto recuperado; en el pequeño corte cubierto, RRF fue el mejor.
4. **Encontrar el documento no garantiza encontrar la evidencia.** Los rangos 84 y 184 son demasiado profundos para un pipeline RAG práctico.

No podemos concluir cuál mezcla híbrida debe usarse en producción. La aparente contradicción —W0.75 gana sobre las 42 preguntas, RRF gana en las tres cubiertas— se explica por la cobertura. En el primer corte conviene confiar casi por completo en BM25 porque la mayoría de los vectores no existen; en el segundo, los vectores sí pueden competir, pero la muestra es mínima.

Cuando termine la indexación repetiremos exactamente el mismo comando sobre las mismas 42 preguntas. Esa corrida será comparable porque el dataset, el corpus, el chunker, las profundidades y las fórmulas de fusión quedaron registrados. La diferencia principal será una sola: el índice vectorial tendrá los 6.73 millones de chunks.

## Qué falta para convertir v4 en una puerta de calidad

V4 es un piloto, no un examen definitivo. Antes de usar un número suyo para aprobar o rechazar cambios del sistema faltan cuatro pasos:

1. **Revisión independiente.** Una segunda persona con experiencia jurídica o de dominio debe revisar cada respuesta y cada cita.
2. **Más áreas del DOF.** La muestra actual se concentra en trabajo, indicadores monetarios, agua, planeación nacional y expropiación. Faltan salud, impuestos, aduanas, contrataciones, medio ambiente y programas sociales.
3. **Separación de desarrollo y prueba.** Los documentos usados para ajustar pesos o modelos de segundo ordenamiento no deben ser los mismos que deciden si el cambio mejora.
4. **Más juicios de relevancia.** Algunas preguntas admiten varias fuentes válidas. El set debe registrar relevancia graduada y documentos alternativos, no forzar una única fuente correcta cuando la tarea no lo requiere.

El cambio importante de v4 no es el tamaño —42 preguntas son pocas— sino el contrato. Una respuesta buena necesita fuentes completas, pasajes concretos y capacidad para rechazar una premisa incorrecta. Ahora podemos medir esas tres cosas por separado y observar dónde falla cada etapa del buscador.

## Ayúdanos a revisar el conjunto

Publicamos una [edición de revisión de las 42 preguntas](/dof-rag-website/es/evals/v4) con sus respuestas, fechas de corte y citas de referencia. Buscamos observaciones sobre preguntas ambiguas, respuestas incompletas, problemas de vigencia y fuentes alternativas que también deberían aceptarse.

No hace falta revisar el conjunto completo. Una corrección bien sustentada sobre una sola pregunta es útil y quedará registrada antes de que v4 se convierta en una puerta de calidad.
