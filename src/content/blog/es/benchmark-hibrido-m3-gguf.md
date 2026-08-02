---
title: "Hybrid retrieval y throughput de embeddings en la Mac M3"
description: "Tercera entrega del benchmark: medimos si la M3 puede indexar el corpus completo (sweep de batch/dtype en MPS y puerto a GGUF/Metal) y evaluamos la fusión de BM25 con embeddings (RRF y weighted). La fusión weighted con α=0.5 supera a ambos componentes por separado y define la configuración de producción."
date: "2026-08-02"
heroImage: ""
category: "desarrollo"
tags: ["dof-rag", "embeddings", "benchmark", "bm25", "hybrid-retrieval", "gguf", "metal", "apple-silicon"]
author: "Joaquín Bravo Contreras"
---

## Motivación

El [benchmark anterior](/es/blog/2026/08/benchmark-embeddings-ronda2-bm25/) cerró con dos pendientes claros:

1. **Hybrid retrieval**: BM25 y embeddings resultaron complementarios por tipo de query. Faltaba medir qué pasa al fusionar los dos rankings.
2. **Throughput de indexación**: al estimado de 20 a 44 días de cómputo para embeddear el corpus completo (~6.5 millones de chunks) en la Mac M3 le faltaba una revisión de optimización antes de comprometer ese tiempo.

Este post cubre ambos experimentos y cierra con la configuración elegida para la indexación de producción. Código y reportes en el PR [#59](https://github.com/CodeandoGuadalajara/dof-rag/pull/59).

## Parte 1: throughput de embedding en la M3

### Sweep de batch size y dtype en PyTorch MPS

Las velocidades de las rondas anteriores (3.7 chunks/s para F2LLM-v2-0.6B, 2.8 para jina-v5-small) salieron del default de sentence-transformers: batch 32, fp32, sin afinar. La primera prueba fue un sweep de batch (32/64/128/256) por dtype (fp32/fp16) sobre 1,378 chunks de 100 documentos, con [`scripts/bench_throughput.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/bench_throughput.py).

| Modelo | fp32 bs=32 | fp32 bs=64 | fp32 bs=128 | fp32 bs=256 | fp16 bs=32 | fp16 bs=64 |
|---|---|---|---|---|---|---|
| F2LLM-v2-0.6B | **3.74** | 3.65 | 3.50 | 2.85 | 3.72 | 3.64 |
| jina-v5-small | **2.93** | 2.23 | 1.34 | OOM | 2.85 | 2.39 |

El default ya era óptimo. Batches más grandes degradan el throughput (los chunks del DOF son largos y la presión de memoria domina), y jina ni siquiera sobrevive a batch 256 en fp32 (MPS OOM). fp16 es numéricamente seguro (coseno 0.9996 contra fp32 en F2LLM, 1.0000 en jina) pero no más rápido. PyTorch MPS no tenía nada escondido.

### GGUF con llama.cpp y Metal

La segunda vía fue correr los modelos con llama.cpp sobre Metal, usando [`scripts/bench_gguf.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/bench_gguf.py) (levanta `llama-server` en modo embedding y mide requests por lotes sobre los mismos 1,378 chunks). Los GGUF ya existen: `mradermacher/F2LLM-v2-0.6B-GGUF` para F2LLM y los GGUF oficiales de `jinaai` para jina-v5.

| Modelo | PyTorch MPS | GGUF f16 | GGUF Q8_0 | Speedup |
|---|---|---|---|---|
| F2LLM-v2-0.6B | 3.74 | **5.34** | 5.15 | 1.43× |
| jina-v5-small | 2.93 | **5.42** | 5.19 | 1.85× |

Q8_0 no es más rápido que f16: el cuello de botella es cómputo, no ancho de banda de memoria. Batches más grandes tampoco ayudan aquí. La conclusión práctica es que el camino local más rápido es GGUF f16 con batch 32, y con eso la indexación del corpus completo baja de 20 a 27 días a **~14 días continuos por modelo**.

### El prefijo de jina que casi pasa desapercibido

Al verificar que los embeddings GGUF fueran equivalentes a los de sentence-transformers, jina daba un coseno de solo 0.958 (mínimo 0.746). La causa: la configuración de sentence-transformers de jina-v5 antepone `Document: ` a los pasajes y `Query: ` a las queries, y llama.cpp no aplica esos prefijos. Agregando `Document: ` explícitamente, el acuerdo sube a 0.9999.

Esto importa para producción: si indexamos con el servidor GGUF, los chunks deben llevar el prefijo `Document: ` y las queries `Query: `, o la calidad de recuperación se degrada silenciosamente. Las corridas del benchmark (que usaban sentence-transformers) sí incluían los prefijos, así que los números publicados siguen siendo válidos.

## Parte 2: hybrid retrieval

### Setup

La evaluación usa el query set de la ronda 3 (499 documentos, 8,065 chunks, 3,023 queries en 6 tipos) y fusiona los rankings de BM25 (SQLite FTS5) con los de cada modelo de embedding a nivel chunk. Dos métodos de fusión, implementados en [`scripts/evaluate_hybrid.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/evaluate_hybrid.py):

- **RRF** (Reciprocal Rank Fusion) con k=60: solo usa las posiciones, no los scores.
- **Weighted**: normaliza los scores de cada sistema a [0,1] por query (min-max) y combina con `α·BM25 + (1−α)·vectores`, con α en {0.25, 0.4, 0.5, 0.6, 0.75}.

Cada sistema aporta sus top 50 chunks a la fusión. Los embeddings quedan cacheados en disco, así que iterar sobre métodos de fusión toma minutos en lugar de horas.

### Resultado general

| Sistema | MRR | Recall@1 | Recall@5 | Recall@10 |
|---|---|---|---|---|
| BM25 solo | 0.616 | 0.561 | 0.687 | 0.728 |
| F2LLM-0.6B int8 solo | 0.561 | 0.496 | 0.646 | 0.707 |
| jina-v5-small binary solo | 0.538 | 0.470 | 0.631 | 0.686 |
| RRF(BM25, F2LLM-int8) | 0.633 | 0.572 | 0.712 | 0.773 |
| **W0.50(BM25, F2LLM-int8)** | **0.661** | **0.596** | **0.749** | **0.789** |
| W0.50(BM25, jina-binary) | 0.646 | 0.573 | 0.744 | 0.784 |

La fusión weighted con α=0.5 es el mejor sistema: +4.5 puntos de MRR sobre BM25 solo y +10 sobre el mejor embedding solo. RRF también supera a los dos componentes, pero queda unos 3 puntos debajo de weighted. La curva de α es plana entre 0.5 y 0.6, así que no hace falta afinar el peso con precisión de relojero.

La cuantización se comporta como se esperaba dentro de la fusión: int8 es indistinguible de fp32 (cuarta confirmación en este proyecto), y jina-binary pierde solo ~1 punto en fusión contra los 2 puntos que pierde solo. BM25 compensa justo donde binary degrada.

### Por tipo de query

Recall@1 de los sistemas relevantes, desglosado por tipo:

| Tipo | BM25 | F2LLM int8 | W0.50 F2LLM | W0.25 F2LLM | W0.75 F2LLM |
|---|---|---|---|---|---|
| first_words (verbatim) | 0.876 | 0.683 | 0.848 | 0.741 | 0.876 |
| factual | 0.703 | 0.469 | 0.659 | 0.527 | 0.708 |
| article_specific | 0.482 | 0.282 | 0.409 | 0.309 | 0.464 |
| paraphrase | 0.565 | 0.773 | 0.783 | **0.813** | 0.645 |
| thematic | 0.301 | 0.446 | 0.450 | **0.492** | 0.354 |
| verbatim_title | 0.222 | 0.220 | 0.238 | 0.226 | 0.246 |

Tres observaciones:

1. **El híbrido cumple la promesa de complementariedad**: con α=0.5 queda cerca del mejor componente en cada tipo y lo supera en Recall@5 y Recall@10 en todos.
2. **Hay sinergia real en paraphrase**: con α=0.25 el híbrido llega a 0.813, mejor que *ambos* padres por separado (F2LLM 0.773, BM25 0.565). La fusión no solo reparte, suma.
3. **El α óptimo depende del tipo de query**: las consultas lexicas (factual, first_words, article_specific) rinden mejor con α=0.75 (peso a BM25); las semánticas (paraphrase, thematic) con α=0.25 (peso a vectores). Un α fijo deja entre 2 y 4 puntos de MRR sobre la mesa. Eso es lo que un weighting adaptativo por query, o el routing agéntico propuesto en el post anterior, debería recuperar.

### A nivel chunk

Para las 1,618 queries con ground truth a nivel chunk, la fusión con α=0.75 logra el mejor Recall@5-chunk (0.804) y MRR-chunk (0.705), superando a BM25 solo (0.798 y 0.696). El detalle completo está en [`reports/hybrid_retrieval.md`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/reports/hybrid_retrieval.md).

## Configuración de producción

Con estos resultados, la elección para la primera indexación del corpus completo es la opción económica:

**jina-v5-text-small con cuantización binary + BM25, fusión weighted α=0.5.**

- Calidad: MRR 0.646 en el eval híbrido, 1.5 puntos debajo de F2LLM-0.6B-int8 (0.661).
- Almacenamiento de vectores para ~6.5M chunks: **0.83 GB** contra 6.7 GB de int8. Esto es lo que hace viable servir el índice sin infraestructura extra.
- Velocidad de indexación local: 5.42 chunks/s vía GGUF/Metal, ~14 días continuos para el corpus completo.
- Requisito descubierto en la Parte 1: indexar con prefijo `Document: ` y consultar con prefijo `Query: `.

F2LLM-0.6B-int8 queda como la opción de calidad si los 1.5 puntos de MRR resultan necesarios en la práctica. La decisión se puede revisar con el mismo harness una vez que exista el índice completo, porque el cuello de botella de re-indexar es cómputo, no diseño.

## Siguientes pasos

1. **Indexación del corpus completo**: script resumible (un trabajo de 14 días en laptop *va* a ser interrumpido), chunker de producción, embeddings vía GGUF/Metal, sqlite-vec con vectores binary y columnas de metadata (fecha, tipo, sección, emisor) extraídas de las rutas de archivo.
2. **Weighting adaptativo por query**: el α óptimo varía por tipo de query; con los embeddings ya cacheados, medir el techo de un esquema adaptativo cuesta minutos.
3. **RAG agéntico**: herramientas de búsqueda con filtros de metadata sobre el índice construido, como se describió en el post anterior.

## Código y datos

- PR: [#59](https://github.com/CodeandoGuadalajara/dof-rag/pull/59)
- Scripts: [`bench_throughput.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/bench_throughput.py), [`bench_gguf.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/bench_gguf.py), [`evaluate_hybrid.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/evaluate_hybrid.py)
- Reportes: [`reports/bench_throughput.md`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/reports/bench_throughput.md), [`reports/hybrid_retrieval.md`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/reports/hybrid_retrieval.md)
