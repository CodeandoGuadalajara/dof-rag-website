---
title: "BM25 contra los embeddings: la revancha del full-text search (y por qué la respuesta es híbrida)"
description: "Ampliamos el benchmark a 499 documentos y 3,023 queries LLM-generadas sobre 28 años de DOF. Agregamos BM25 como baseline, probamos late chunking en pplx-embed-context y descubrimos que BM25 y embeddings capturan señales complementarias."
date: "2026-08-01"
heroImage: ""
category: "desarrollo"
tags: ["dof-rag", "embeddings", "benchmark", "bm25", "rag", "hybrid-retrieval"]
author: "Joaquín Bravo Contreras"
---

## La revancha

En el [benchmark anterior](/es/blog/2026/07/benchmark-embeddings-dof/) comparamos 10 modelos de embedding en velocidad, memoria y calidad de recuperación sobre 50 documentos del DOF. Ganó F2LLM-v2-1.7B en calidad, F2LLM-v2-0.6B en calidad-por-tamaño, y validamos que int8 es gratis. Pero quedaron tres preguntas abiertas:

1. **¿Qué pasa con más documentos?** 50 docs del 2020–2024 es una muestra pequeña. El corpus real tiene ~660k archivos spanning 1999–2026.
2. **¿Late chunking ayuda?** pplx-embed-context-v1 tiene una ventaja contextual que no activamos en la ronda 1.
3. **¿Cómo le va contra búsqueda tradicional?** Nunca comparamos contra BM25 — el full-text search que lleva 30 años funcionando.

Esta es la segunda ronda. Ampliamos a **499 documentos** del corpus completo (1999–2026), generamos **3,023 queries** con un LLM (no solo títulos verbatim), agregamos **BM25 vía SQLite FTS5** como baseline, y probamos **late chunking real** para pplx-embed-context.

El código y los reportes están en el PR [#58](https://github.com/CodeandoGuadalajara/dof-rag/pull/58) del repo `dof-rag`.

## El setup

**Hardware**: MacBook Pro M3 (36 GB RAM), MPS (Metal). Mismo que la ronda 1.

**Corpus**: `dof_md-local` — 657,867 archivos markdown materializados localmente, años 1999–2026, 61 GB. Muestra estratificada por año × patrón del chunker (para que la muestra no se llene de AVISOs pequeños y incluya tablas gigantes y decretos compuestos).

**Modelos**: nos concentramos en los 4 ganadores de la ronda 1:

| Modelo | Params | Dims | Por qué sigue |
|---|---|---|---|
| [F2LLM-v2-1.7B](https://huggingface.co/codefuse-ai/F2LLM-v2-1.7B) | 1.7B | 2,048 | Ganador en calidad absoluta |
| [F2LLM-v2-0.6B](https://huggingface.co/codefuse-ai/F2LLM-v2-0.6B) | 0.6B | 1,024 | Ganador en calidad-por-tamaño |
| [pplx-embed-context-v1](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) | 0.6B | 1,024 | Candidato contextual (late chunking) |
| [jina-v5-text-small](https://huggingface.co/jinaai/jina-embeddings-v5-text-small) | 0.6B | 1,024 | Binary quantization entrenado |

Más **BM25** vía SQLite FTS5 (`unicode61 remove_diacritics 1`, sin stemming) — el mismo motor que usaremos en producción con [sqlite-vec](https://github.com/asg017/sqlite-vec).

## Ronda 2: 200 docs, BM25 entra al ring

Primera expansión: 200 documentos, 400 queries (mismas queries verbatim de la ronda 1: títulos + primeras 20 palabras).

| Sistema | MRR | Recall@1 | Recall@5 |
|---|---|---|---|
| **BM25 (FTS5)** | **0.592** | **0.557** | 0.637 |
| F2LLM-v2-1.7B | 0.554 | 0.480 | **0.650** |
| F2LLM-v2-0.6B | 0.513 | 0.453 | 0.598 |
| pplx-embed-context | 0.451 | 0.380 | 0.545 |
| jina-v5-small | 0.415 | 0.350 | 0.500 |

**BM25 ganó.** El full-text search que llevamos décadas usando le ganó a todos los modelos de embedding en MRR y Recall@1. F2LLM-1.7B se consolida como el mejor embedding y el único que le pelea de tú a tú (gana en Recall@5/@10, donde BM25 se estanca).

¿Por qué? Con queries verbatim (el título del documento o sus primeras palabras), BM25 tiene una ventaja injusta: las queries *contienen literalmente* las palabras del documento. Es búsqueda por string, no semántica. Para saber si los embeddings aportan algo real, necesitábamos mejores preguntas.

## Late chunking: el superpoder que no se materializó

pplx-embed-context-v1 fue diseñado para **late chunking** ([Günther et al., 2023](https://arxiv.org/abs/2409.04701)): en lugar de embeddear cada chunk de forma aislada, se hace un forward pass del **documento completo** y se mean-poolean los embeddings a nivel token sobre el span de cada chunk. Así cada chunk "ve" el resto del documento.

Lo implementamos con tracking de offsets: un splitter que registra las posiciones de carácter de cada chunk, un forward pass por documento (hasta 32,768 tokens), y mean-pooling sobre los tokens de cada span.

| Encoding | Chunks | Recall@1 | Recall@5 | MRR | Tiempo |
|---|---|---|---|---|---|
| standard (chunk por chunk) | 1,451 | 0.335 | 0.510 | 0.406 | 407s |
| late chunking (doc completo) | 1,067 | 0.343 | 0.480 | 0.400 | 1,245s |

**Δ MRR: −0.6 puntos.** No hubo ganancia — y costó 3× más tiempo.

El cave at: 6 documentos gigantes (tablas de hasta 188k tokens) excedieron el límite de 32k tokens y se truncaron, perdiendo 384 chunks (26% del pool). En producción haría falta encoding ventaneado para esos casos. Pero incluso ignorando eso, no hay señal de que el contexto ayude en este corpus.

**Hallazgo colateral**: el mismo modelo pplx con el chunker de producción (overlap + prefijos de encabezado) alcanza MRR 0.451 vs 0.406 con el splitter desnudo. **El overlap y los prefijos aportan ~4.5 puntos por sí solos** — más que todo el late chunking.

## Ronda 3: mejores preguntas

El verdadero problema de las rondas 1 y 2 eran las queries. Si solo preguntas con palabras que están en el documento, BM25 siempre va a ganar. Necesitábamos preguntas que **un ciudadano o abogado haría**, con vocabulario distinto al del decreto.

### Generación de queries con LLM

Construimos `scripts/generate_queries.py`: toma cada documento, lo divide en chunks numerados, y le pide a un LLM que genere preguntas realistas de varios tipos. Usamos Kimi k3-256k para la mayoría, y DeepSeek V4 Flash para los reintentos.

**6 tipos de query**:

| Tipo | Descripción | Ground truth |
|---|---|---|
| `verbatim_title` | Título del doc (igual que ronda 1) | doc |
| `first_words` | Primeras 20 palabras (igual que ronda 1) | doc |
| `paraphrase` | Tema reformulado, sin copiar 5+ palabras del doc | doc |
| `thematic` | Pregunta ciudadana sin jerga legal | doc |
| `factual` | Pregunta específica respondible por un chunk | **chunk** |
| `article_specific` | "¿Qué establece el artículo 5 de…?" | **chunk** |

Validación programática: filtro de n-gram overlap (paraphrase/thematic no pueden copiar 5 palabras consecutivas), dedup, bounds de chunk index, formato de pregunta. **499 documentos, 3,023 queries, 1,618 con chunk-level ground truth** (el chunk exacto que responde la pregunta).

### La tabla maestra (ronda 3)

| Sistema | MRR | Recall@1 | Recall@5 | Recall@10 |
|---|---|---|---|---|
| **BM25 (FTS5)** | **0.616** | **0.561** | 0.687 | 0.728 |
| F2LLM-v2-1.7B | 0.595 | 0.534 | **0.677** | **0.725** |
| F2LLM-v2-0.6B | 0.561 | 0.495 | 0.647 | 0.707 |
| pplx-embed-context | 0.559 | 0.493 | 0.647 | 0.716 |
| jina-v5-small | 0.558 | 0.493 | 0.645 | 0.697 |

BM25 sigue ganando en MRR general, pero la ventaja se redujo: de +3.8 pts en la ronda 2 a +2.1 pts en la ronda 3. Los embeddings cerraron la brecha con mejores preguntas.

### El desglose por tipo: la señal que esperábamos

Aquí es donde la historia se pone interesante. Mirar el MRR agregado esconde lo que realmente pasa:

| Tipo | n | BM25 R@1 | F2LLM-1.7B R@1 | ¿Quién gana? |
|---|---|---|---|---|
| `first_words` | 499 | **0.876** | 0.770 | BM25 |
| `factual` | 1,009 | **0.703** | 0.484 | BM25 |
| `article_specific` | 110 | **0.482** | 0.291 | BM25 |
| `paraphrase` | 428 | 0.565 | **0.832** | **Embeddings** |
| `thematic` | 478 | 0.301 | **0.521** | **Embeddings** |
| `verbatim_title` | 499 | 0.222 | 0.212 | empate (ambos malos) |

**BM25 domina cuando la query comparte vocabulario con el documento.** En `factual` (0.703 vs 0.484) y `first_words` (0.876 vs 0.770), las preguntas usan las mismas palabras del decreto — exactamente lo que BM25 hace mejor.

**Los embeddings dominan cuando la query reformula el tema.** En `paraphrase` (0.832 vs 0.565) y `thematic` (0.521 vs 0.301), las preguntas usan vocabulario distinto — un ciudadano preguntando "¿qué apoyos hay para pescadores?" no usa las palabras "ACUERDO" ni "CONVOCATORIA" que aparecen en el decreto. Los embeddings sí lo entienden; BM25 no.

**`verbatim_title` es difícil para todos.** R@1 de 0.22 — peor que azar para muchos casos. ¿Por qué? El corpus de 28 años tiene miles de decretos con títulos casi idénticos que se repiten anualmente ("AVISO de licitación pública nacional...", "ACUERDO por el que se emiten..."). Un título solo no distingue un documento de sus 50 hermanos.

### Chunk-level: ¿el chunk exacto o solo el doc correcto?

Las queries `factual`, `article_specific` y `first_words` tienen anotado **qué chunk específico** responde la pregunta (no solo qué documento). Esto mide algo más estricto: ¿el sistema devuelve el pasaje correcto, o solo el documento correcto?

| Sistema | n | Recall@5 chunk | MRR chunk |
|---|---|---|---|
| **BM25** | 1,618 | **0.798** | **0.696** |
| F2LLM-v2-1.7B | 1,618 | 0.643 | 0.536 |
| jina-v5-small | 1,618 | 0.625 | 0.511 |
| pplx-embed-context | 1,618 | 0.635 | 0.521 |
| F2LLM-v2-0.6B | 1,618 | 0.600 | 0.500 |

BM25 también gana aquí (0.798 vs 0.643). Pero la brecha es menor que a nivel documento: los embeddings a veces recuperan el documento correcto pero el chunk equivocado. Para RAG, esto importa — el LLM que genera la respuesta solo ve los chunks recuperados, no el documento completo.

## La cuantización sigue siendo la misma historia

| Modelo | int8 Δ | binary Δ | mrl_768 Δ |
|---|---|---|---|
| pplx-embed-context | +0.0 pts | -4.5 pts | -0.6 pts |
| F2LLM-v2-1.7B | -0.0 pts | -1.7 pts | -0.7 pts |
| F2LLM-v2-0.6B | +0.0 pts | -4.4 pts | -0.8 pts |
| jina-v5-text-small | +0.1 pts | -2.0 pts | -0.7 pts |

Tres rondas, misma conclusión: **int8 es gratis**, binary solo es seguro con jina (que está entrenado para ello), y truncar a 768 dims cuesta ~1 punto en todos.

## Lecciones

1. **BM25 no es un baseline despreciable.** En tres rondas con queries cada vez más realistas, BM25 ganó MRR general. El full-text search lleva décadas funcionando por una razón. Cualquier sistema RAG sobre DOF necesita BM25 como componente fijo, no como comparación.

2. **Embeddings y BM25 son complementarios.** El desglose por tipo de query muestra que cada uno captura señales distintas. BM25 gana cuando hay overlap lexical; embeddings ganan cuando hay reformulación semántica. **La respuesta es hybrid retrieval** — combinar ambos rankings (vía RRF o fusión ponderada).

3. **Late chunking no es plata.** Lo probamos con el modelo diseñado para ello y no hubo ganancia. El contexto del documento completo no ayudó a pplx-embed-context en este corpus — quizás porque los decretos del DOF son ya autocontenidos por chunk, o quizás porque el modelo no explota el contexto tan bien como sugiere su marketing.

4. **El chunker importa tanto como el modelo.** El overlap + prefijos de encabezado del chunker de producción aportan ~4.5 pts de MRR — más que la diferencia entre el mejor y el peor modelo de embedding.

5. **Las queries importan más que los modelos.** Pasar de queries verbatim a queries LLM-generadas cambió completamente el ranking y reveló la complementariedad BM25/embeddings. Un eval con queries malas mide la cosa equivocada.

## Código y datos

- Scripts: [`scripts/evaluate_retrieval.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/scripts/evaluate_retrieval.py), [`scripts/generate_queries.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/scripts/generate_queries.py), [`scripts/evaluate_late_chunking.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/scripts/evaluate_late_chunking.py) (PR [#58](https://github.com/CodeandoGuadalajara/dof-rag/pull/58))
- Query set: [`eval/dof_queries_v2.jsonl`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/eval/dof_queries_v2.jsonl) — 499 docs, 3,023 queries, versionado y reutilizable
- Reporte de recuperación: [`reports/retrieval_evaluation.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/reports/retrieval_evaluation.md)
- Reporte de late chunking: [`reports/late_chunking_evaluation.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/reports/late_chunking_evaluation.md)

## Siguientes pasos

- **Hybrid retrieval**: fusionar rankings BM25 + vector (RRF o weighted fusion). Si BM25 gana factual y embeddings ganan paraphrase, la combinación debería ganar en todo. Es el experimento obvio y el siguiente paso del proyecto.
- **Más queries y documentos**: 3,023 queries sobre 499 docs es bueno, pero el corpus tiene 660k. Escalar a 2,000+ docs cuando el modelo de producción esté elegido.
- **Decisión final de producción**: con estos resultados, el default probable es F2LLM-v2-0.6B (calidad/costo) + FTS5 como componente fijo, con int8 para los vectores.
