---
title: "La evaluación final: búsqueda híbrida contra los 657,867 documentos, con los 6.73 millones de vectores completos"
description: "Once días de cómputo después, la corrida de embeddings terminó y corrimos la evaluación híbrida completa en los cortes v2 y v3 del set. La fusión supera a cada componente por separado en ambos cortes — pero el peso ganador cambia de un corte al otro (W0.5 en v2, W0.75 en v3), y el mismo tipo de consulta (paráfrasis) prefiere extremos opuestos según si trae anclas o no. El argumento del peso adaptativo ya no es una hipótesis: es una medición."
date: "2026-08-19"
heroImage: ""
category: "desarrollo"
tags: ["dof-rag", "evaluacion", "bm25", "vector-search", "embedding", "sqlite"]
author: "Joaquín Bravo Contreras"
---

## De qué estamos hablando

El [post anterior](/es/blog/2026/08/eval-bm25-corpus-completo/) cerró con una promesa: cuando terminara la corrida de embeddings —los 6.73 millones de vectores que alimentan el componente vectorial de la búsqueda híbrida— correríamos la evaluación final contra el corpus completo y reportaríamos ambos cortes del set de evaluación. También cerró con una pregunta concreta: no el MRR absoluto, sino **si la fusión híbrida seguiría ganando a cada componente por separado a escala real**, y por qué margen.

La corrida terminó. Once días de GPU continua (con dos reanudaciones, como estaba previsto) convirtieron los 6,730,304 chunks del Diario Oficial en vectores binarios de 1,024 bits. El índice de búsqueda vectorial (sqlite-vec, `bit[1024]`) quedó en 980 MiB y responde un barrido de vecinos por distancia de Hamming en **327 ms por consulta** — dentro de lo proyectado en el piloto. Con eso, la evaluación final fueron dos comandos sobre el corpus completo: 657,867 documentos haciendo de distractor, sin restricciones de elegibilidad.

Un recordatorio mínimo del vocabulario (el post anterior lo desarrolla con calma): medimos con **MRR**, el promedio de 1/posición del documento correcto; el **componente BM25** busca por palabras exactas y premia los términos raros; el **componente vectorial** busca por cercanía semántica entre embeddings y tolera el parafraseo; y la **fusión** combina ambas listas, ya sea por rangos (RRF) o por una suma ponderada de puntajes donde α es el peso de BM25 (W0.25 le da 25% a BM25 y 75% a vectores; W0.75 al revés). El set de evaluación tiene dos cortes: **v2** (3,023 consultas, con los defectos originales) y **v3** (3,013 consultas, con títulos reales y consultas regeneradas con anclas identificadoras — fechas, montos, números de acuerdo). Reportamos ambos para mantener la comparabilidad histórica. Código y resultados reproducibles en el [PR #70 de `dof-rag`](https://github.com/CodeandoGuadalajara/dof-rag/pull/70), continuación del [PR #63](https://github.com/CodeandoGuadalajara/dof-rag/pull/63).

Resultados primero; el análisis va por secciones:

| Sistema | v2 MRR | v3 MRR |
|---|---:|---:|
| W0.75 (75% BM25 + 25% vectores) | 0.190 | **0.390** |
| W0.5 (50/50) | **0.196** | 0.369 |
| RRF (fusión por rangos) | 0.194 | 0.360 |
| solo BM25 | 0.170 | 0.366 |
| W0.25 (25% BM25 + 75% vectores) | 0.160 | 0.272 |
| solo vectores | 0.138 | 0.219 |

La respuesta corta a la pregunta del post anterior: **sí, la fusión gana a escala real, en ambos cortes y con cualquier α razonable**. Pero el detalle de qué fusión gana en dónde resulta más interesante que el titular.

## Los números completos

v2, 3,023 consultas contra 657,867 documentos, profundidad 50:

| Sistema | MRR | R@1 | R@5 | R@10 |
|---|---:|---:|---:|---:|
| W0.5 | **0.196** | 0.132 | 0.265 | 0.322 |
| RRF | 0.194 | 0.136 | 0.258 | 0.314 |
| W0.75 | 0.190 | 0.139 | 0.238 | 0.290 |
| solo BM25 | 0.170 | 0.119 | 0.224 | 0.269 |
| W0.25 | 0.160 | 0.108 | 0.204 | 0.266 |
| solo vectores | 0.138 | 0.096 | 0.183 | 0.226 |

v3, 3,013 consultas, mismo corpus:

| Sistema | MRR | R@1 | R@5 | R@10 |
|---|---:|---:|---:|---:|
| W0.75 | **0.390** | 0.309 | 0.482 | 0.536 |
| W0.5 | 0.369 | 0.274 | 0.484 | 0.545 |
| solo BM25 | 0.366 | 0.282 | 0.462 | 0.519 |
| RRF | 0.360 | 0.274 | 0.464 | 0.535 |
| W0.25 | 0.272 | 0.199 | 0.330 | 0.411 |
| solo vectores | 0.219 | 0.159 | 0.286 | 0.338 |

Y el desglose por tipo de consulta, que es donde está la historia. v2:

| Tipo | BM25 | vectores | W0.25 | W0.5 | W0.75 | RRF |
|---|---:|---:|---:|---:|---:|---:|
| factual | 0.282 | 0.149 | 0.189 | 0.280 | **0.307** | 0.289 |
| first_words | 0.227 | 0.187 | 0.218 | **0.259** | 0.247 | 0.242 |
| paráfrasis | 0.118 | 0.195 | **0.209** | 0.193 | 0.147 | 0.190 |
| artículo específico | 0.118 | 0.068 | 0.082 | 0.129 | **0.140** | 0.118 |
| título literal | 0.082 | 0.096 | 0.099 | **0.100** | 0.092 | 0.097 |
| temática | 0.025 | 0.073 | **0.077** | 0.069 | 0.038 | 0.067 |

v3:

| Tipo | BM25 | vectores | W0.25 | W0.5 | W0.75 | RRF |
|---|---:|---:|---:|---:|---:|---:|
| temática | 0.641 | 0.407 | 0.507 | 0.648 | **0.671** | 0.623 |
| paráfrasis | 0.611 | 0.276 | 0.374 | 0.575 | **0.635** | 0.535 |
| factual | 0.282 | 0.150 | 0.189 | 0.280 | **0.306** | 0.289 |
| título literal | 0.260 | 0.196 | 0.225 | 0.271 | **0.281** | 0.276 |
| first_words | 0.227 | 0.187 | 0.218 | **0.259** | 0.247 | 0.244 |
| artículo específico | 0.118 | 0.068 | 0.082 | 0.134 | **0.140** | 0.118 |

## Tres lecturas

**1. El peso óptimo no existe — ni siquiera por tipo de consulta.** En v2, las paráfrasis prefieren la fusión cargada a vectores (W0.25: 0.209); en v3, las paráfrasis prefieren la fusión cargada a BM25 (W0.75: 0.635). Es el mismo tipo de consulta, la misma tarea, los mismos documentos; lo que cambió es que las paráfrasis de la v3 traen anclas (una fecha, un monto, un número de licitación como `LO-013J2W002-E21-2023`). Con ancla, BM25 es casi imbatible porque el IDF premia exactamente esos tokens; sin ancla, los vectores rescatan la sinonimia. La conclusión práctica es fuerte: el α de fusión no debe elegirse por tipo de consulta ni globalmente, sino **por consulta individual, según cuántos términos raros contenga**. Eso es medible en línea con la tabla de frecuencias que ya construimos para podar stopwords (`fts5vocab`, 2.35 millones de términos con su frecuencia documental), así que el siguiente experimento está servido: un clasificador de anclas que elija α por pregunta.

**2. El componente vectorial solo se degradó con la escala; como socio de fusión, aporta.** Los vectores binarios solos bajaron de 0.252 (smoke test con 1.39 M de vectores) a 0.219 con el corpus completo, y el golpe se concentró donde su ventaja era mayor: en artículo específico pasaron de duplicar a BM25 (0.208 contra 0.104) a quedar por debajo (0.068 contra 0.118). Con 6.73 millones de chunks binarios, los distractores semánticamente plausibles crecieron más rápido que la capacidad del vector de 1,024 bits para distinguirlos. Aun así, ningún tipo de consulta prefiere BM25 puro sobre la mejor fusión — en todos, alguna combinación queda arriba, y la brecha es grande precisamente donde BM25 flaquea (temática v2: 0.025 contra 0.077). La arquitectura híbrida se sostiene, pero la pierna vectorial tiene techo conocido: candidatos naturales para levantarlo son embeddings de más capacidad (float en vez de binario, o un modelo mayor) solo para re-rankear el top de la fusión, no para el barrido completo.

**3. La brecha que había que vigilar se mantuvo, más modesta de lo que sugería el subconjunto.** Sobre los 499 documentos del piloto, la híbrida ganaba con claridad amplia; a escala real el margen del mejor híbrido sobre BM25 puro es de +15% relativo en v2 (0.196 contra 0.170) y de +6.6% en v3 (0.390 contra 0.366). La interpretación honesta es doble: la fusión nunca pierde y gana de forma consistente, pero cuando las consultas traen anclas, BM25 sobre un buen índice FTS5 es un competidor durísimo y barato — la fusión se paga con los tipos de consulta donde el vocabulario no alcanza.

## Qué cambió respecto al smoke test

El último post reportó W0.5 a 0.402 y prometió que el número final sería distinto. Lo es (0.369 con W0.5, 0.390 con W0.75), y la diferencia está explicada por el diseño del smoke test, no por una sorpresa: aquella corrida solo medía las 665 consultas cuyo documento oro ya estaba embebido — un subconjunto con sesgo optimista, porque excluía exactamente las consultas cuyos documentos tardaron más en procesarse— y la búsqueda vectorial barría 1.39 millones de vectores en vez de 6.73 millones. La evaluación final no tiene esas concesiones: todas las consultas, todos los distractores, todos los vectores. Que el número final quede dentro de ~3 puntos del smoke test dice que la mecánica medida entonces era genuina.

## Estado y lo que falta

1. **Recuperación a escala real: medida y cerrada.** Corpus (657,867 documentos), chunks (6.73 M), FTS5, embeddings y vec0 construidos; evaluación híbrida final corrida en ambos cortes con resultados deterministas publicados. La documentación de construcción quedó actualizada en `docs/full-corpus-build.md`.
2. **Siguiente experimento de recuperación**: α adaptativo por consulta según densidad de anclas, y re-ranking del top fusionado con embeddings de mayor capacidad. Ambos usan infraestructura que ya existe.
3. **Herramientas de metadata para el agente**: búsqueda por título, lookup por ruta/slug y filtros por fecha/sección/emisor — las columnas ya están en el corpus. Con un agente que elija herramienta y peso por pregunta, los tipos que hoy se ven débiles cambian de naturaleza.
4. **Pendiente no técnico**: la revisión de licencias de sqlite-vector (Elastic 2.0 modificada) y sqlite-zstd (LGPL-3.0) antes de producción; sqlite-vec es MIT.
5. **Del otro lado del pipeline**: con la recuperación medida, la frontera del proyecto se mueve a la calidad de las respuestas completas del agente — y para eso está en marcha el piloto de evaluación humana, donde cada respuesta publicada podrá ser revisada por personas. De eso escribimos pronto.
