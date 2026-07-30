---
title: "Benchmark de embeddings: 10 modelos compiten por entender el DOF (y gana uno de 0.6B)"
description: "Comparamos 10 modelos de embedding en velocidad, memoria y calidad de recuperación sobre documentos reales del DOF. Probamos cuantización int8, binaria y truncado Matryoshka. Los leaderboards públicos no predijeron al ganador."
date: "2026-07-30"
heroImage: ""
category: "desarrollo"
tags: ["dof-rag", "embeddings", "benchmark", "rag", "mteb", "decision"]
author: "Joaquín Bravo Contreras"
---

## Después del chunker, el modelo

En los posts anteriores resolvimos cómo dividir los documentos del DOF: construimos un [chunker por patrón](/es/blog/2026/05/chunker-patron-dof/) y lo [validamos contra Chonkie](/es/blog/2026/07/custom-vs-chonkie-decision-chunker/). También hicimos una [primera batalla de embeddings en 2025](/es/blog/2025/08/La-batalla-de-los-embeddings-cuando-tres-modelos-de-IA-compiten-por-entender-el-espaol-gubernamental/) con tres modelos comerciales; ahora repetimos el ejercicio en serio, con 10 modelos open corriendo local. El siguiente problema: **¿con qué modelo convertimos ~1 millón de chunks a vectores?**

La elección importa por tres razones:

- **Calidad**: el embedding determina qué tan bien el sistema encuentra el decreto correcto para una pregunta.
- **Costo**: embedder el corpus completo se hace una vez, pero re-indexar con otro modelo cuesta días de cómputo. Hay que elegir bien a la primera.
- **Almacenamiento**: 1M chunks × 1,024 dimensiones × 4 bytes = 4 GB de vectores. La cuantización puede bajar eso a 1 GB... si no destruye la calidad (ya habíamos explorado esto en las [proyecciones de almacenamiento](/es/blog/2025/09/Proyecciones-de-Almacenamiento-para-DOF-RAG/)).

Evaluamos 10 modelos en dos ejes —velocidad y calidad de recuperación— más un tercer experimento de cuantización y dimensiones. Todo el código y los reportes están en el PR [#57](https://github.com/CodeandoGuadalajara/dof-rag/pull/57). Este post cuenta los resultados.

## El setup

**Hardware**: MacBook Pro M3 (36 GB RAM) con MPS (Metal Performance Shaders). El servidor de producción es un Hetzner con CPU Ryzen, pero la Mac embeddea 4-6x más rápido, así que la generación de embeddings se hará ahí.

**Velocidad**: 100 archivos DOF (1,378 chunks), batch 32, vía [`sentence-transformers`](https://www.sbert.net/).

**Calidad**: 50 documentos, 100 queries sintéticas (50 títulos de documento + 50 "primeras 20 palabras", simulando queries de lenguaje natural), métricas estándar: Recall@k, MRR, NDCG con similitud coseno.

**Muestra determinística** (seed 42, archivos ordenados): reproducible en cualquier máquina.

## Los 10 competidores

| Modelo | Params | Dims | Por qué entra |
|---|---|---|---|
| [pplx-embed-context-v1-0.6b](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) | 0.6B | 1,024 | Nuestro candidato original: contextual (late chunking), ONNX local |
| [pplx-embed-v1-0.6b](https://huggingface.co/perplexity-ai/pplx-embed-v1-0.6b) | 0.6B | 1,024 | Su hermano no-contextual |
| [F2LLM-v2-1.7B](https://huggingface.co/codefuse-ai/F2LLM-v2-1.7B) | 1.7B | 2,048 | Fuerte en MTEB(Law) |
| [F2LLM-v2-0.6B](https://huggingface.co/codefuse-ai/F2LLM-v2-0.6B) | 0.6B | 1,024 | El mismo, en tamaño chico |
| [jina-embeddings-v5-text-small](https://huggingface.co/jinaai/jina-embeddings-v5-text-small) | 0.6B | 1,024 | Soporta binary quantization |
| [jina-embeddings-v5-text-nano](https://huggingface.co/jinaai/jina-embeddings-v5-text-nano) | 0.2B | 768 | El más chico de todos |
| [Octen-Embedding-0.6B](https://huggingface.co/Octen/Octen-Embedding-0.6B) | 0.6B | 1,024 | Top-15 mundial en RTEB multilingual |
| [Nemotron-3-Embed-1B](https://huggingface.co/nvidia/Nemotron-3-Embed-1B-BF16) | 1.1B | 2,048 | NVIDIA, dims altas |
| [harrier-oss-v1-0.6b](https://huggingface.co/microsoft/harrier-oss-v1-0.6b) | 0.6B | 1,024 | Debut open de Microsoft |
| [Qwen3-Embedding-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) | 0.6B | 1,024 | El más descargado del leaderboard (10.5M) |

## Resultado 1: la tabla maestra

| Modelo | Dims | Chunks/s | Recall@1 | Recall@5 | MRR |
|---|---|---|---|---|---|
| **[F2LLM-v2-1.7B](https://huggingface.co/codefuse-ai/F2LLM-v2-1.7B)** | 2,048 | 1.7 | **0.500** | 0.620 | **0.542** |
| [pplx-embed-v1](https://huggingface.co/perplexity-ai/pplx-embed-v1-0.6b) | 1,024 | 3.3 | 0.450 | 0.610 | 0.512 |
| [pplx-embed-context-v1](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) | 1,024 | 3.2 | 0.420 | **0.650** | 0.511 |
| **[F2LLM-v2-0.6B](https://huggingface.co/codefuse-ai/F2LLM-v2-0.6B)** | 1,024 | **3.7** | 0.440 | 0.590 | 0.500 |
| [jina-v5-text-small](https://huggingface.co/jinaai/jina-embeddings-v5-text-small) | 1,024 | 2.8 | 0.410 | 0.560 | 0.464 |
| [harrier-oss-v1-0.6b](https://huggingface.co/microsoft/harrier-oss-v1-0.6b) | 1,024 | 3.6 | 0.360 | 0.590 | 0.464 |
| [Octen-0.6B](https://huggingface.co/Octen/Octen-Embedding-0.6B) | 1,024 | 3.6 | 0.410 | 0.530 | 0.455 |
| [Qwen3-Embedding-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) | 1,024 | 3.7 | 0.410 | 0.510 | 0.449 |
| [jina-v5-text-nano](https://huggingface.co/jinaai/jina-embeddings-v5-text-nano) | 768 | **11.3** | 0.380 | 0.530 | 0.443 |
| [Nemotron-3-Embed-1B](https://huggingface.co/nvidia/Nemotron-3-Embed-1B-BF16) | 2,048 | 2.7 | 0.300 | 0.440 | 0.359 |

Tres historias aquí.

**[F2LLM-v2-1.7B](https://huggingface.co/codefuse-ai/F2LLM-v2-1.7B) es el mejor en calidad absoluta.** Recall@1 de 0.500: la mitad de las veces, el documento correcto aparece en primer lugar. Pero es el más lento (1.7 chunks/s) y pesa el doble por vector (2,048 dims).

**[F2LLM-v2-0.6B](https://huggingface.co/codefuse-ai/F2LLM-v2-0.6B) es la revelación.** MRR 0.500 — solo 4 puntos abajo de su hermano grande — con 3x menos parámetros y 2.2x más velocidad. La mejor calidad-por-tamaño de todo el benchmark. Agregamos este modelo precisamente para tener la comparación a tamaño igual contra el 1.7B, y resultó ser el hallazgo más útil.

**pplx se mantiene fuerte.** [pplx-embed-v1](https://huggingface.co/perplexity-ai/pplx-embed-v1-0.6b) (0.512) y [pplx-embed-context-v1](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) (0.511) son #2 y #3. Ojo: context-v1 tiene el mejor Recall@5/@10 (0.650/0.700) y todavía no hemos activado su superpoder: el late chunking contextual, donde los chunks del mismo documento se embeddeen viéndose entre sí (algo que ya exploramos con [encabezados estructurados como contexto](/es/blog/2025/05/Dndole-contexto-a-los-embeddings-Los-encabezados-estructurados/)). Aquí se evaluó como embedder estándar chunk-por-chunk, así que su techo real es más alto.

## Resultado 2: los leaderboards públicos no predijeron nada

Antes de correr el benchmark local, analizamos el [MTEB leaderboard](https://huggingface.co/spaces/mteb/leaderboard) usando el dataset [`mteb/results`](https://huggingface.co/datasets/mteb/results) (8.5M scores), filtrando por RTEB multilingual y MTEB(Law). El ranking público decía:

- [Octen-0.6B](https://huggingface.co/Octen/Octen-Embedding-0.6B): **top-15 mundial** en RTEB multilingual (74.94)
- [Qwen3-Embedding](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B): la familia más descargada ([anuncio oficial](https://qwenlm.github.io/blog/qwen3-embedding/)), arriba de Octen y jina en RTEB
- [Nemotron-3-Embed-1B](https://huggingface.co/nvidia/Nemotron-3-Embed-1B-BF16): 73.66 en RTEB, sólido

En nuestro corpus de español legal mexicano:

- **[Octen-0.6B](https://huggingface.co/Octen/Octen-Embedding-0.6B) quedó media tabla** (0.455, #7 de 10)
- **[Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) quedó debajo de Octen y jina** (0.449), invirtiendo el orden del leaderboard
- **[Nemotron-1B](https://huggingface.co/nvidia/Nemotron-3-Embed-1B-BF16) fue el peor de todos** (0.359), y encima lento y con el doble de dims
- Los modelos [pplx](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) **ni siquiera aparecen en el leaderboard**, y aquí son #2 y #3

La explicación: los tasks de MTEB(Law) son en inglés, alemán y chino (AILA, LegalBench, GerDaLIR, LeCaRD). Un modelo que gana en ley inglesa no necesariamente entiende un decreto fiscal mexicano. **Lección: el leaderboard sirve para shortlistear candidatos, pero la decisión se toma con un eval sobre tu propio dominio.**

## Resultado 3: la cuantización int8 es gratis

El tercer experimento: sobre los mismos embeddings fp32, aplicamos transformaciones post-hoc y re-medimos calidad:

- **int8**: cuantización escalar por vector (4x menos bytes)
- **binary**: signo, 1 bit por dimensión (32x menos bytes)
- **mrl_768**: truncado [Matryoshka](https://arxiv.org/abs/2205.13147) a 768 dimensiones

Δ MRR vs full fp32:

| Modelo | int8 | binary | mrl_768 |
|---|---|---|---|
| pplx-embed-context-v1 | +0.0 | -2.8 | **+0.3** |
| pplx-embed-v1 | +0.0 | -2.7 | -3.0 |
| F2LLM-v2-1.7B | +0.0 | -2.3 | -0.5 |
| F2LLM-v2-0.6B | +0.1 | -4.2 | +0.2 |
| jina-v5-text-small | +0.0 | **+0.5** | -1.1 |
| jina-v5-text-nano | +0.0 | -2.5 | (768 nativo) |
| harrier-oss | +0.0 | -1.2 | -2.2 |
| Octen-0.6B | +0.0 | -1.8 | -2.2 |
| Qwen3-0.6B | +0.0 | -2.9 | -0.9 |
| Nemotron-1B | +0.3 | -2.0 | -0.8 |

![Impacto de cuantización int8, binary y truncado Matryoshka a 768 dimensiones sobre el MRR de cada modelo. int8 no pierde calidad en ninguno; binary solo mejora a jina-v5-text-small](/images/posts/benchmark-embeddings/quantization.svg)

*Las barras verdes (int8) están todas pegadas al cero: la compresión 4x es gratis. La única barra roja positiva es jina-v5-text-small, el único modelo entrenado con binary quantization.*

**int8 no cuesta nada.** Entre +0.0 y +0.3 puntos de MRR en los 10 modelos: la reducción 4x de almacenamiento viene sin pérdida medible de calidad. Esto valida la arquitectura planeada: [sqlite-vec](https://github.com/asg017/sqlite-vec) guardando vectores int8, con distancia L2 equivalente a coseno. No hay razón para guardar fp32 en producción.

**Binary solo funciona donde está entrenado.** [jina-v5-text-small](https://huggingface.co/jinaai/jina-embeddings-v5-text-small) es el único modelo que *mejora* con binarización (+0.5 pts) — Jina entrena sus modelos con soporte de binary quantization, y se nota. 128 bytes por vector: todo el corpus cabría en ~128 MB de vectores (ver [proyecciones de almacenamiento](/es/blog/2025/09/Proyecciones-de-Almacenamiento-para-DOF-RAG/)). [harrier](https://huggingface.co/microsoft/harrier-oss-v1-0.6b) (-1.2) y [Octen](https://huggingface.co/Octen/Octen-Embedding-0.6B) (-1.8) degradan poco; el resto pierde 2-4 puntos. Para los F2LLM, prohibido binarizar (-4.2).

**Truncar a 768 no compensa.** Casi todos pierden 0.5-3 puntos al cortar dimensiones. Ni siquiera Qwen3 — que sí está entrenado con Matryoshka — sale ileso (-0.9). Las excepciones curiosas: pplx-context (+0.3) y F2LLM-0.6B (+0.2) no pierden nada, aunque eso es ruido estadístico. La conclusión práctica: **si int8 te da 4x gratis, no tiene sentido pagar calidad por otro 25% de espacio**. Mejor int8 a dimensiones nativas.

## La frontera de Pareto

![Frontera de Pareto: velocidad de embedding vs MRR para los 10 modelos. F2LLM-v2-1.7B lidera en calidad, jina-nano en velocidad, pplx-v1 y F2LLM-v2-0.6B en el balance](/images/posts/benchmark-embeddings/pareto.svg)

*Gráfica generada con [`scripts/plot_embedding_benchmark.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/embedding-model-comparison/scripts/plot_embedding_benchmark.py) a partir de los reportes del benchmark (PR [#57](https://github.com/CodeandoGuadalajara/dof-rag/pull/57)). El tamaño del punto es proporcional a los parámetros; el color indica las dimensiones del vector.*

No hay un solo ganador; hay cuatro, según la prioridad:

- **Máxima calidad**: [F2LLM-v2-1.7B](https://huggingface.co/codefuse-ai/F2LLM-v2-1.7B) (MRR 0.542) — si aceptamos ~7 días de indexación del corpus completo
- **Calidad por tamaño**: [F2LLM-v2-0.6B](https://huggingface.co/codefuse-ai/F2LLM-v2-0.6B) (0.500 a 3.7 chunks/s) — 94% de la calidad del grande a mitad de precio de almacenamiento
- **Balance + late chunking**: [pplx-embed-context-v1](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) — con la ventaja contextual todavía sin explotar
- **Escala extrema**: [jina-v5-small](https://huggingface.co/jinaai/jina-embeddings-v5-text-small) binario (128 B/vec) o [jina-v5-nano](https://huggingface.co/jinaai/jina-embeddings-v5-text-nano) (11.3 chunks/s, corpus en ~25 horas)

## Estimados para el corpus completo (~1M chunks, int8)

| Modelo | Tiempo de embedding | Vectores |
|---|---|---|
| jina-v5-text-nano | ~25 h | 0.75 GB |
| harrier / Qwen3 / Octen / F2LLM-0.6B | ~75 h | 1 GB |
| pplx-v1 / context-v1 | ~85 h | 1 GB |
| jina-v5-small | ~99 h | 1 GB |
| F2LLM-v2-1.7B | ~163 h | 2 GB |

## Lecciones

1. **El tamaño no es la calidad.** [F2LLM-0.6B](https://huggingface.co/codefuse-ai/F2LLM-v2-0.6B) casi empata a su hermano 1.7B; [jina-nano](https://huggingface.co/jinaai/jina-embeddings-v5-text-nano) (0.2B) queda a 13% de modelos 3x más grandes. En embeddings, el entrenamiento pesa más que los parámetros.

2. **Los benchmarks públicos son en inglés.** [MTEB(Law)](https://huggingface.co/spaces/mteb/leaderboard) evalúa ley inglesa/alemana/china. Para español jurídico mexicano, el orden se invierte. El eval local no es opcional.

3. **int8 siempre.** Cero pérdida, 4x ahorro. Es la decisión más fácil de todo el proyecto.

4. **La cuantización binaria es una feature del modelo, no del formato.** Solo funciona donde el entrenamiento la contempló (jina). Binarizar embeddings ajenos cuesta 2-4 puntos de MRR.

5. **Medir velocidad en el hardware real.** La Mac M3 embeddea 4-6x más rápido que el servidor Hetzner (CPU). La estrategia: generar embeddings en la Mac, servir búsquedas en Hetzner.

## Código y benchmarks

- Scripts: [`scripts/compare_embeddings.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/embedding-model-comparison/scripts/compare_embeddings.py) y [`scripts/evaluate_retrieval.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/embedding-model-comparison/scripts/evaluate_retrieval.py) (PR [#57](https://github.com/CodeandoGuadalajara/dof-rag/pull/57))
- Reporte unificado: [`reports/embedding_comparison_full.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/embedding-model-comparison/reports/embedding_comparison_full.md)
- Análisis del MTEB leaderboard: [`reports/embedding_model_candidates.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/embedding-model-comparison/reports/embedding_model_candidates.md)
- Comparación Mac vs Hetzner: [`reports/macos_vs_hetzner.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/embedding-model-comparison/reports/macos_vs_hetzner.md)

## Siguientes pasos

- **Late chunking real** para [pplx-embed-context-v1](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b): su ventaja contextual aún no está activada en este eval (ya dimos un primer paso con [encabezados estructurados](/es/blog/2025/05/Dndole-contexto-a-los-embeddings-Los-encabezados-estructurados/))
- Probar los candidatos Tier 1 del análisis MTEB que faltan: [Qwen3-Embedding-4B](https://huggingface.co/Qwen/Qwen3-Embedding-4B), [Octen-Embedding-4B](https://huggingface.co/Octen/Octen-Embedding-4B) (el mejor ≤4B en RTEB), y [dinghy-law-0.6b](https://huggingface.co/Hanno-Labs/dinghy-law-0.6b-v1) (especializado en ley)
- Medir latencia de búsqueda [sqlite-vec](https://github.com/asg017/sqlite-vec) con vectores int8
- Decisión final de producción y generación del corpus completo
