---
title: "Benchmark de embeddings ronda 2: BM25, late chunking y queries LLM-generadas"
description: "Segunda ronda del benchmark: 499 documentos del corpus completo (1999-2026), 3,023 queries generadas con LLM en 6 tipos, baseline de BM25 con FTS5, y evaluación de late chunking para pplx-embed-context. BM25 y embeddings resultan complementarios por tipo de query."
date: "2026-08-01"
heroImage: ""
category: "desarrollo"
tags: ["dof-rag", "embeddings", "benchmark", "bm25", "rag", "hybrid-retrieval"]
author: "Joaquín Bravo Contreras"
---

## Motivación

El [benchmark anterior](/es/blog/2026/07/benchmark-embeddings-dof/) evaluó 10 modelos de embedding sobre 50 documentos del DOF (2020–2024) con queries sintéticas (títulos y primeras 20 palabras). Quedaron tres pendientes:

1. **Más documentos**: 50 docs es poco para sacar conclusiones sobre un corpus de ~660k archivos.
2. **Late chunking**: pplx-embed-context-v1 está diseñado para embedding contextual pero se evaluó chunk-por-chunk.
3. **Baseline de BM25**: faltaba comparar contra búsqueda de texto completo, que es lo que SQLite FTS5 da gratis.

Esta ronda expande a **499 documentos** del corpus completo (1999–2026), genera **3,023 queries** con un LLM en 6 tipos distintos, agrega **BM25** como baseline, y evalúa **late chunking** para pplx-embed-context.

Código y reportes en el PR [#58](https://github.com/CodeandoGuadalajara/dof-rag/pull/58).

## Setup

**Hardware**: MacBook Pro M3 (36 GB), MPS.

**Corpus**: `dof_md-local`, 657,867 archivos markdown locales, 1999–2026, 61 GB. Muestra estratificada por año y por patrón del chunker (SMALL, H2_COMPOUND, BOLD_HEADERS, PLAIN_TEXT, GIANT_TABLE) para evitar que la muestra se llene de AVISOs pequeños.

**Modelos evaluados** (los 4 ganadores de la ronda 1):

| Modelo | Params | Dims | Notas |
|---|---|---|---|
| [F2LLM-v2-1.7B](https://huggingface.co/codefuse-ai/F2LLM-v2-1.7B) | 1.7B | 2,048 | Mejor MRR en ronda 1 |
| [F2LLM-v2-0.6B](https://huggingface.co/codefuse-ai/F2LLM-v2-0.6B) | 0.6B | 1,024 | Mejor calidad/tamaño en ronda 1 |
| [pplx-embed-context-v1](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) | 0.6B | 1,024 | Diseñado para late chunking |
| [jina-v5-text-small](https://huggingface.co/jinaai/jina-embeddings-v5-text-small) | 0.6B | 1,024 | Entrenado con binary quantization |

**Baseline**: BM25 vía SQLite FTS5, tokenizer `unicode61 remove_diacritics 1`, sin stemming. MATCH con OR de términos. Sobre los mismos chunks y queries que los embeddings.

## Métricas

- **Recall@k**: proporción de queries donde el documento correcto aparece en los top-k resultados.
- **MRR** (Mean Reciprocal Rank): promedio de 1/rank del documento correcto. Premisa: estar en posición 1 vale más que en posición 10.
- **Chunk-level Recall@k**: igual que Recall@k pero verifica si el chunk exacto que responde la query aparece en top-k, no solo el documento. Solo aplica a queries con ground truth a nivel chunk.

## Ronda 2: 200 docs, queries verbatim

Primera expansión: 200 documentos, 400 queries (mismas que ronda 1: títulos y primeras 20 palabras, todas verbatim).

| Sistema | MRR | Recall@1 | Recall@5 |
|---|---|---|---|
| BM25 (FTS5) | 0.592 | 0.557 | 0.637 |
| F2LLM-v2-1.7B | 0.554 | 0.480 | 0.650 |
| F2LLM-v2-0.6B | 0.513 | 0.453 | 0.598 |
| pplx-embed-context | 0.451 | 0.380 | 0.545 |
| jina-v5-small | 0.415 | 0.350 | 0.500 |

BM25 quedó primero en MRR y Recall@1. F2LLM-v2-1.7B fue el mejor embedding y el único competitivo con BM25 (gana Recall@5 y Recall@10, donde BM25 se estanca porque solo devuelve documentos que contienen los términos exactos de la query).

El problema: las queries verbatim contienen las mismas palabras del documento. Eso es exactamente lo que BM25 hace bien. Para medir si los embeddings aportan algo que BM25 no puede, necesitábamos queries con vocabulario distinto.

## Late chunking para pplx-embed-context

Late chunking ([Günther et al., 2023](https://arxiv.org/abs/2409.04701)): en lugar de embeddear cada chunk por separado, se hace un forward pass del documento completo y se mean-poolean los embeddings a nivel token sobre el span de cada chunk. Cada chunk embedding tiene contexto del documento entero.

Implementación: splitter con tracking de offsets (posiciones de carácter), un forward pass por documento (hasta 32,768 tokens), mean-pooling sobre los tokens cuyo offset cae dentro del span del chunk. Comparación pareada: los mismos chunks codificados de las dos formas, mismas queries.

| Codificación | Chunks | Recall@1 | Recall@5 | MRR | Tiempo |
|---|---|---|---|---|---|
| Standard (chunk por chunk) | 1,451 | 0.335 | 0.510 | 0.406 | 407s |
| Late chunking (doc completo) | 1,067 | 0.343 | 0.480 | 0.400 | 1,245s |

Δ MRR: −0.6 puntos. No hubo ganancia y tomó 3× más tiempo.

6 documentos gigantes (tablas de hasta 188k tokens) excedieron el límite de 32k y se truncaron, perdiendo 384 chunks (26% del pool). Esos chunks no se pudieron embeddear con contexto. En producción se necesitaría encoding ventaneado para esos casos, pero la ausencia de ganancia en los chunks que sí se procesaron no motiva a invertir en eso.

Dato adicional: el mismo modelo pplx con el chunker de producción (overlap + prefijos de encabezado) alcanza MRR 0.451 vs 0.406 con el splitter sin overlap ni prefijos. El chunker aporta ~4.5 puntos por sí solo, más que cualquier diferencia entre modelos de embedding.

## Ronda 3: queries LLM-generadas

### Generación

Construimos `scripts/generate_queries.py`. Para cada documento: lo divide en chunks numerados, le envía al LLM los chunks con un prompt estructurado, y pide preguntas de varios tipos. Usamos Kimi k3-256k para la mayoría y DeepSeek V4 Flash para los reintentos (499 docs válidos de 500 muestreados).

**6 tipos de query**:

| Tipo | Descripción | Ground truth | Ejemplo |
|---|---|---|---|
| `verbatim_title` | Título del documento | documento | "MANUAL de percepciones de los servidores públicos de mando de la CNDH..." |
| `first_words` | Primeras 20 palabras del chunk 0 | documento (chunk 0) | "Al margen un sello con el Escudo Nacional, que dice: Estados Unidos Mexicanos..." |
| `paraphrase` | Tema reformulado, sin copiar 5+ palabras consecutivas del doc | documento | "Esquema de remuneraciones y beneficios aplicable al personal directivo del organismo defensor de derechos humanos" |
| `thematic` | Pregunta ciudadana sin jerga legal | documento | "¿Cuánto ganan y qué prestaciones reciben los altos funcionarios de la CNDH?" |
| `factual` | Pregunta específica respondible por un chunk | **chunk** | "¿En qué grado está clasificado el puesto de Presidente de la CNDH?" (chunk 4) |
| `article_specific` | "¿Qué establece el artículo X de…?" | **chunk** | "¿Qué establece el artículo transitorio décimo del Decreto 317?" (chunk 5) |

Validación programática: filtro de 5-gram overlap para paraphrase/thematic (no pueden copiar 5 palabras consecutivas del documento), dedup, verificación de chunk index, formato de pregunta. Las queries `factual`, `article_specific` y `first_words` tienen anotado el chunk exacto que responde.

Total: **499 documentos, 3,023 queries, 1,618 con chunk-level ground truth**. El dataset está versionado en `eval/dof_queries_v2.jsonl` y es reutilizable para futuros evals.

### Resultado general

| Sistema | MRR | Recall@1 | Recall@5 | Recall@10 |
|---|---|---|---|---|
| BM25 (FTS5) | 0.616 | 0.561 | 0.687 | 0.728 |
| F2LLM-v2-1.7B | 0.595 | 0.534 | 0.677 | 0.725 |
| F2LLM-v2-0.6B | 0.561 | 0.495 | 0.647 | 0.707 |
| pplx-embed-context | 0.559 | 0.493 | 0.647 | 0.716 |
| jina-v5-small | 0.558 | 0.493 | 0.645 | 0.697 |

BM25 sigue primero en MRR general, pero la ventaja sobre F2LLM-v2-1.7B bajó de +3.8 pts (ronda 2) a +2.1 pts (ronda 3). Los embeddings mejoraron relativamente con queries más diversas porque algunas preguntas usan vocabulario que no aparece en el documento.

### Resultado por tipo de query

Esta tabla muestra Recall@1 (proporción de queries donde el documento correcto apareció en primer lugar) desglosado por tipo. Aquí es donde se ve la diferencia real entre BM25 y embeddings:

| Tipo de query | n queries | BM25 R@1 | F2LLM-1.7B R@1 | Observación |
|---|---|---|---|---|
| first_words (verbatim) | 499 | 0.876 | 0.770 | BM25: las palabras están en el doc |
| factual (vocabulario del doc) | 1,009 | 0.703 | 0.484 | BM25: términos exactos |
| article_specific | 110 | 0.482 | 0.291 | BM25: "artículo X" aparece literal |
| paraphrase (otras palabras) | 428 | 0.565 | 0.832 | Embeddings: entienden el significado |
| thematic (jerga ciudadana) | 478 | 0.301 | 0.521 | Embeddings: vocabulario distinto |
| verbatim_title | 499 | 0.222 | 0.212 | Ambos fallan: títulos duplicados |

**BM25 gana cuando la query usa las mismas palabras del documento.** En `factual` y `first_words`, las preguntas contienen términos que aparecen literalmente en el decreto ("Licitación Pública Nacional Electrónica", "artículo 5"). BM25 encuentra eso por coincidencia de texto.

**Embeddings ganan cuando la query reformula el tema.** En `paraphrase` y `thematic`, las preguntas usan vocabulario que no está en el documento. "¿Cuánto ganan los altos funcionarios de la CNDH?" no contiene las palabras "MANUAL", "percepciones", ni "servidores públicos de mando" que aparecen en el decreto. Los embeddings capturan la relación semántica; BM25 no la encuentra.

**`verbatim_title` es difícil para ambos.** Recall@1 de 0.22. El corpus de 28 años tiene miles de decretos con títulos casi idénticos que se repiten cada año ("AVISO de licitación pública nacional...", "ACUERDO por el que se emiten..."). Un título solo no distingue un documento de sus decenas de hermanos anuales. Ni BM25 ni embeddings pueden resolver cuál es el correcto.

### Chunk-level: ¿se recupera el chunk exacto?

Las queries `factual`, `article_specific` y `first_words` (1,618 en total) tienen anotado el chunk específico que responde. Esta métrica verifica si ese chunk aparece en top-k, no solo el documento:

| Sistema | n queries | R@5 chunk | MRR chunk |
|---|---|---|---|
| BM25 (FTS5) | 1,618 | 0.798 | 0.696 |
| F2LLM-v2-1.7B | 1,618 | 0.643 | 0.536 |
| pplx-embed-context | 1,618 | 0.635 | 0.521 |
| jina-v5-small | 1,618 | 0.625 | 0.511 |
| F2LLM-v2-0.6B | 1,618 | 0.600 | 0.500 |

BM25 también gana a nivel chunk (0.798 vs 0.643 en R@5). La diferencia con la métrica a nivel documento es que los embeddings a veces recuperan el documento correcto pero un chunk equivocado dentro de ese documento. Para RAG esto importa: el modelo generativo solo ve los chunks recuperados, no el documento completo, así que devolver el chunk equivocado del doc correcto genera respuestas incorrectas.

## Cuantización

Mismas variantes post-hoc que la ronda 1, sobre los mismos embeddings fp32. Δ MRR respecto al baseline fp32:

| Modelo | int8 | binary (1 bit/dim) | mrl_768 (truncado) |
|---|---|---|---|
| pplx-embed-context | +0.0 pts | -4.5 pts | -0.6 pts |
| F2LLM-v2-1.7B | -0.0 pts | -1.7 pts | -0.7 pts |
| F2LLM-v2-0.6B | +0.0 pts | -4.4 pts | -0.8 pts |
| jina-v5-text-small | +0.1 pts | -2.0 pts | -0.7 pts |

Tres rondas, mismo resultado: int8 no pierde calidad en ningún modelo, binary solo es viable con jina (único modelo entrenado para ello), truncar a 768 dims cuesta ~1 punto uniforme.

## Conclusiones

1. **BM25 es competitivo y complementario.** En MRR general ganó las tres rondas. Pero el desglose por tipo muestra que gana cuando hay overlap lexical y pierde cuando la query reformula el tema. Un sistema RAG sobre DOF necesita ambos: BM25 para búsquedas con términos exactos, embeddings para búsquedas semánticas.

2. **Late chunking no ayudó en este corpus.** pplx-embed-context con encoding del documento completo no mejoró sobre encoding chunk-por-chunk (Δ MRR −0.6 pts). El contexto del documento completo no agregó información útil para los chunks del DOF, que tienden a ser autocontenidos. El chunker (overlap + prefijos) aportó más que el late chunking.

3. **El chunker importa tanto como el modelo.** La diferencia de MRR entre el mejor y el peor modelo de embedding es ~4 pts. El chunker de producción aporta ~4.5 pts sobre un splitter básico. La calidad del chunking es tan importante como la elección de modelo.

4. **Las queries del eval importan más que los modelos.** Con queries verbatim, BM25 parecía infinitamente superior. Con queries LLM-generadas que incluyen reformulaciones, los embeddings cerraron la brecha. Un eval con queries que solo copian el texto del documento mide coincidencia de strings, no recuperación semántica.

5. **int8 sigue siendo gratis.** Tres rondas confirman que la cuantización int8 no pierde calidad en ningún modelo. Para producción: sqlite-vec con vectores int8.

## Código y datos

- Scripts: [`evaluate_retrieval.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/scripts/evaluate_retrieval.py), [`generate_queries.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/scripts/generate_queries.py), [`evaluate_late_chunking.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/scripts/evaluate_late_chunking.py) (PR [#58](https://github.com/CodeandoGuadalajara/dof-rag/pull/58))
- Query set: [`eval/dof_queries_v2.jsonl`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/eval/dof_queries_v2.jsonl) — 499 docs, 3,023 queries, 1,618 con chunk-level GT
- Reporte de recuperación: [`reports/retrieval_evaluation.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/reports/retrieval_evaluation.md)
- Reporte de late chunking: [`reports/late_chunking_evaluation.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/reports/late_chunking_evaluation.md)

## Siguientes pasos

- **Hybrid retrieval**: fusionar rankings de BM25 y vectores (RRF o weighted fusion). El desglose por tipo sugiere que la combinación debería ganar en todos los tipos: BM25 cubre factual/first_words, embeddings cubren paraphrase/thematic.
- **Escalar el eval**: más documentos y queries cuando el modelo de producción esté elegido. 499 docs es suficiente para comparar modelos, pero no para medir degradación a escala.
- **Decisión de producción**: con estos resultados, el candidato es F2LLM-v2-0.6B (calidad/costo) + FTS5 como componente fijo + int8 para los vectores.
