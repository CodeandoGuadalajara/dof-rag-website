---
title: "Embedding Benchmark: 10 Models Compete to Understand the DOF (and a 0.6B One Wins)"
description: "We compare 10 embedding models on speed, memory, and retrieval quality over real DOF documents. We test int8, binary, and Matryoshka truncation quantization. Public leaderboards didn't predict the winner."
date: "2026-07-30"
heroImage: ""
category: "development"
tags: ["dof-rag", "embeddings", "benchmark", "rag", "mteb", "decision"]
author: "Joaquín Bravo Contreras"
---

## After the Chunker, the Model

In previous posts we solved how to split documents from the Official Journal of the Federation (DOF): we built a [pattern-based chunker](/en/blog/2026/05/chunker-patron-dof/) and [validated it against Chonkie](/en/blog/2026/07/custom-vs-chonkie-decision-chunker/). We also ran a [first embedding battle in 2025](/en/blog/2025/08/La-batalla-de-los-embeddings-cuando-tres-modelos-de-IA-compiten-por-entender-el-espaol-gubernamental/) with three commercial models; now we repeat the exercise seriously, with 10 open models running locally. The next problem: **which model do we use to convert ~1 million chunks into vectors?**

The choice matters for three reasons:

- **Quality**: the embedding determines how well the system finds the right decree for a question.
- **Cost**: embedding the full corpus is done once, but re-indexing with another model costs days of compute. We have to choose right the first time.
- **Storage**: 1M chunks × 1,024 dimensions × 4 bytes = 4 GB of vectors. Quantization can bring that down to 1 GB… if it doesn't destroy quality (we had already explored this in the [storage projections](/en/blog/2025/09/Proyecciones-de-Almacenamiento-para-DOF-RAG/)).

We evaluated 10 models on two axes —speed and retrieval quality— plus a third quantization-and-dimensions experiment. All code and reports are in PR [#57](https://github.com/CodeandoGuadalajara/dof-rag/pull/57). This post tells the results.

## The Setup

**Hardware**: MacBook Pro M3 (36 GB RAM) with MPS (Metal Performance Shaders). The production server is a Hetzner with a Ryzen CPU, but the Mac embeds 4-6× faster, so embedding generation will be done there.

**Speed**: 100 DOF files (1,378 chunks), batch 32, via [`sentence-transformers`](https://www.sbert.net/).

**Quality**: 50 documents, 100 synthetic queries (50 document titles + 50 "first 20 words," simulating natural-language queries), standard metrics: Recall@k, MRR, NDCG with cosine similarity.

**Deterministic sample** (seed 42, ordered files): reproducible on any machine.

## The 10 Contenders

| Model | Params | Dims | Why it's here |
|---|---|---|---|
| [pplx-embed-context-v1-0.6b](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) | 0.6B | 1,024 | Our original candidate: contextual (late chunking), local ONNX |
| [pplx-embed-v1-0.6b](https://huggingface.co/perplexity-ai/pplx-embed-v1-0.6b) | 0.6B | 1,024 | Its non-contextual sibling |
| [F2LLM-v2-1.7B](https://huggingface.co/codefuse-ai/F2LLM-v2-1.7B) | 1.7B | 2,048 | Strong on MTEB(Law) |
| [F2LLM-v2-0.6B](https://huggingface.co/codefuse-ai/F2LLM-v2-0.6B) | 0.6B | 1,024 | Same model, small size |
| [jina-embeddings-v5-text-small](https://huggingface.co/jinaai/jina-embeddings-v5-text-small) | 0.6B | 1,024 | Supports binary quantization |
| [jina-embeddings-v5-text-nano](https://huggingface.co/jinaai/jina-embeddings-v5-text-nano) | 0.2B | 768 | The smallest of all |
| [Octen-Embedding-0.6B](https://huggingface.co/Octen/Octen-Embedding-0.6B) | 0.6B | 1,024 | Top-15 worldwide on RTEB multilingual |
| [Nemotron-3-Embed-1B](https://huggingface.co/nvidia/Nemotron-3-Embed-1B-BF16) | 1.1B | 2,048 | NVIDIA, high dims |
| [harrier-oss-v1-0.6b](https://huggingface.co/microsoft/harrier-oss-v1-0.6b) | 0.6B | 1,024 | Microsoft's open debut |
| [Qwen3-Embedding-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) | 0.6B | 1,024 | The leaderboard's most downloaded (10.5M) |

## Result 1: The Master Table

| Model | Dims | Chunks/s | Recall@1 | Recall@5 | MRR |
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

Three stories here.

**[F2LLM-v2-1.7B](https://huggingface.co/codefuse-ai/F2LLM-v2-1.7B) is the best in absolute quality.** Recall@1 of 0.500: half the time, the correct document appears first. But it's the slowest (1.7 chunks/s) and twice as heavy per vector (2,048 dims).

**[F2LLM-v2-0.6B](https://huggingface.co/codefuse-ai/F2LLM-v2-0.6B) is the standout finding.** MRR 0.500 — only 4 points below its big sibling — with 3× fewer parameters and 2.2× the speed. The best quality-to-size ratio in the whole benchmark. We added this model precisely to have an equal-size comparison against the 1.7B, and it turned out to be the most useful finding.

**pplx stays strong.** [pplx-embed-v1](https://huggingface.co/perplexity-ai/pplx-embed-v1-0.6b) (0.512) and [pplx-embed-context-v1](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) (0.511) are #2 and #3. Note: context-v1 has the best Recall@5/@10 (0.650/0.700) and we still haven't activated its superpower: contextual late chunking, where chunks from the same document are embedded seeing each other (something we already explored with [structured headers as context](/en/blog/2025/05/Dndole-contexto-a-los-embeddings-Los-encabezados-estructurados/)). Here it was evaluated as a standard chunk-by-chunk embedder, so its real ceiling is higher.

## Result 2: Public Leaderboards Didn't Predict Anything

Before running the local benchmark, we analyzed the [MTEB leaderboard](https://huggingface.co/spaces/mteb/leaderboard) using the [`mteb/results`](https://huggingface.co/datasets/mteb/results) dataset (8.5M scores), filtering for RTEB multilingual and MTEB(Law). The public ranking said:

- [Octen-0.6B](https://huggingface.co/Octen/Octen-Embedding-0.6B): **top-15 worldwide** on RTEB multilingual (74.94)
- [Qwen3-Embedding](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B): the most downloaded family ([official announcement](https://qwenlm.github.io/blog/qwen3-embedding/)), above Octen and jina on RTEB
- [Nemotron-3-Embed-1B](https://huggingface.co/nvidia/Nemotron-3-Embed-1B-BF16): 73.66 on RTEB, solid

On our Mexican legal Spanish corpus:

- **[Octen-0.6B](https://huggingface.co/Octen/Octen-Embedding-0.6B) ended up mid-table** (0.455, #7 of 10)
- **[Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) ended up below Octen and jina** (0.449), inverting the leaderboard order
- **[Nemotron-1B](https://huggingface.co/nvidia/Nemotron-3-Embed-1B-BF16) was the worst of all** (0.359), and on top of that slow and with double the dims
- The [pplx](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) models **don't even appear on the leaderboard**, and here they are #2 and #3

The explanation: MTEB(Law) tasks are in English, German, and Chinese (AILA, LegalBench, GerDaLIR, LeCaRD). A model that wins on English law doesn't necessarily understand a Mexican fiscal decree. **Lesson: the leaderboard is useful for shortlisting candidates, but the decision is made with an eval on your own domain.**

## Result 3: int8 Quantization Is Free

The third experiment: on the same fp32 embeddings, we applied post-hoc transformations and re-measured quality:

- **int8**: scalar quantization per vector (4× fewer bytes)
- **binary**: sign, 1 bit per dimension (32× fewer bytes)
- **mrl_768**: [Matryoshka](https://arxiv.org/abs/2205.13147) truncation to 768 dimensions

Δ MRR vs full fp32:

| Model | int8 | binary | mrl_768 |
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

![Impact of int8, binary, and 768-dimension Matryoshka truncation quantization on each model's MRR. int8 loses no quality on any model; binary only improves jina-v5-text-small](/images/posts/benchmark-embeddings/quantization.svg)

*The green bars (int8) are all hugging zero: the 4× compression is free. The only positive red bar is jina-v5-text-small, the only model trained with binary quantization.*

**int8 costs nothing.** Between +0.0 and +0.3 MRR points across all 10 models: the 4× storage reduction comes with no measurable quality loss. This validates the planned architecture: [sqlite-vec](https://github.com/asg017/sqlite-vec) storing int8 vectors, with L2 distance equivalent to cosine. There's no reason to store fp32 in production.

**Binary only works where it's trained.** [jina-v5-text-small](https://huggingface.co/jinaai/jina-embeddings-v5-text-small) is the only model that *improves* with binarization (+0.5 pts) — Jina trains its models with binary quantization support, and it shows. 128 bytes per vector: the whole corpus would fit in ~128 MB of vectors (see [storage projections](/en/blog/2025/09/Proyecciones-de-Almacenamiento-para-DOF-RAG/)). [harrier](https://huggingface.co/microsoft/harrier-oss-v1-0.6b) (-1.2) and [Octen](https://huggingface.co/Octen/Octen-Embedding-0.6B) (-1.8) degrade little; the rest lose 2-4 points. For the F2LLMs, binarization is off-limits (-4.2).

**Truncating to 768 doesn't pay off.** Almost everyone loses 0.5-3 points when cutting dimensions. Not even Qwen3 — which is trained with Matryoshka — escapes unscathed (-0.9). The curious exceptions: pplx-context (+0.3) and F2LLM-0.6B (+0.2) lose nothing, although that's statistical noise. The practical conclusion: **if int8 gives you 4× for free, it makes no sense to pay quality for another 25% of space**. Better to use int8 at native dimensions.

## The Pareto Frontier

![Pareto frontier: embedding speed vs MRR for the 10 models. F2LLM-v2-1.7B leads in quality, jina-nano in speed, pplx-v1 and F2LLM-v2-0.6B in balance](/images/posts/benchmark-embeddings/pareto.svg)

*Chart generated with [`scripts/plot_embedding_benchmark.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/embedding-model-comparison/scripts/plot_embedding_benchmark.py) from the benchmark reports (PR [#57](https://github.com/CodeandoGuadalajara/dof-rag/pull/57)). Point size is proportional to parameters; color indicates vector dimensions.*

There's no single winner; there are four, depending on priority:

- **Maximum quality**: [F2LLM-v2-1.7B](https://huggingface.co/codefuse-ai/F2LLM-v2-1.7B) (MRR 0.542) — if we accept ~7 days to index the full corpus
- **Quality for size**: [F2LLM-v2-0.6B](https://huggingface.co/codefuse-ai/F2LLM-v2-0.6B) (0.500 at 3.7 chunks/s) — 94% of the big model's quality at half the storage cost
- **Balance + late chunking**: [pplx-embed-context-v1](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) — with the contextual advantage still untapped
- **Extreme scale**: [jina-v5-small](https://huggingface.co/jinaai/jina-embeddings-v5-text-small) binary (128 B/vec) or [jina-v5-nano](https://huggingface.co/jinaai/jina-embeddings-v5-text-nano) (11.3 chunks/s, corpus in ~25 hours)

## Estimates for the Full Corpus (~1M chunks, int8)

| Model | Embedding time | Vectors |
|---|---|---|
| jina-v5-text-nano | ~25 h | 0.75 GB |
| harrier / Qwen3 / Octen / F2LLM-0.6B | ~75 h | 1 GB |
| pplx-v1 / context-v1 | ~85 h | 1 GB |
| jina-v5-small | ~99 h | 1 GB |
| F2LLM-v2-1.7B | ~163 h | 2 GB |

## Lessons

1. **Size isn't quality.** [F2LLM-0.6B](https://huggingface.co/codefuse-ai/F2LLM-v2-0.6B) nearly ties its 1.7B sibling; [jina-nano](https://huggingface.co/jinaai/jina-embeddings-v5-text-nano) (0.2B) is within 13% of models 3× larger. In embeddings, training matters more than parameters.

2. **Public benchmarks are in English.** [MTEB(Law)](https://huggingface.co/spaces/mteb/leaderboard) evaluates English/German/Chinese law. For Mexican legal Spanish, the order inverts. The local eval is not optional.

3. **Always int8.** Zero loss, 4× savings. It's the easiest decision in the whole project.

4. **Binary quantization is a model feature, not a format feature.** It only works where training accounted for it (jina). Binarizing embeddings from other models costs 2-4 MRR points.

5. **Measure speed on real hardware.** The Mac M3 embeds 4-6× faster than the Hetzner server (CPU). The strategy: generate embeddings on the Mac, serve searches from Hetzner.

## Code and Benchmarks

- Scripts: [`scripts/compare_embeddings.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/embedding-model-comparison/scripts/compare_embeddings.py) and [`scripts/evaluate_retrieval.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/embedding-model-comparison/scripts/evaluate_retrieval.py) (PR [#57](https://github.com/CodeandoGuadalajara/dof-rag/pull/57))
- Unified report: [`reports/embedding_comparison_full.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/embedding-model-comparison/reports/embedding_comparison_full.md)
- MTEB leaderboard analysis: [`reports/embedding_model_candidates.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/embedding-model-comparison/reports/embedding_model_candidates.md)
- Mac vs Hetzner comparison: [`reports/macos_vs_hetzner.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/embedding-model-comparison/reports/macos_vs_hetzner.md)

## Next Steps

- **Real late chunking** for [pplx-embed-context-v1](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b): its contextual advantage is still not activated in this eval (we already took a first step with [structured headers as context](/en/blog/2025/05/Dndole-contexto-a-los-embeddings-Los-encabezados-estructurados/))
- Test the missing Tier 1 candidates from the MTEB analysis: [Qwen3-Embedding-4B](https://huggingface.co/Qwen/Qwen3-Embedding-4B), [Octen-Embedding-4B](https://huggingface.co/Octen/Octen-Embedding-4B) (the best ≤4B on RTEB), and [dinghy-law-0.6b](https://huggingface.co/Hanno-Labs/dinghy-law-0.6b-v1) (law-specialized)
- Measure [sqlite-vec](https://github.com/asg017/sqlite-vec) search latency with int8 vectors
- Final production decision and full corpus generation
