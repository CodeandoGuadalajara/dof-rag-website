---
title: "Hybrid search: how to combine BM25 and embeddings (and make them fit on a laptop)"
description: "Third installment of the benchmark: we merge the BM25 and embedding rankings and the result beats both individually. We also measure how to index the full corpus from the Mac M3: what works (GGUF/Metal), what does not (large batches, fp16), and why jina's binary quantization decides the storage architecture."
date: "2026-08-02"
heroImage: ""
category: "development"
tags: ["dof-rag", "embeddings", "benchmark", "bm25", "hybrid-retrieval", "gguf", "apple-silicon"]
author: "Joaquín Bravo Contreras"
---

## Motivation

The [previous benchmark](/en/blog/2026/08/benchmark-embeddings-ronda2-bm25/) ended with an uncomfortable conclusion and an unfinished task.

The uncomfortable conclusion: BM25 (exact-word search) and embeddings (meaning-based search) win on different question types. If someone asks “What does Article 5 of Decree 317 establish?”, BM25 wins because those words literally appear in the document. If someone asks “How much do senior officials of the CNDH earn?”, embeddings win because the document talks about a “MANUAL de percepciones de servidores públicos de mando” and BM25 cannot find those words in the question. A system that uses only one of the two will fail on half the questions a citizen asks.

The unfinished task: indexing the full corpus (~6.5 million chunks) would take between 20 and 44 days of continuous compute on the Mac M3 with the configuration we used in the benchmark. Before committing weeks of compute, we needed to check whether that time could be reduced.

This post describes how we solved both. The short answer: merging the two rankings yields a system better than either one alone, and a port to GGUF/Metal nearly doubles embedding speed on the M3. Code and reports are in PR [#59](https://github.com/CodeandoGuadalajara/dof-rag/pull/59).

## What is rank fusion?

Both systems answer a question by returning a ranked list of results: BM25 orders by word overlap, embeddings by semantic similarity. Fusing them means taking the two lists and producing a single combined list. There are two standard ways to do it:

- **RRF** (Reciprocal Rank Fusion): ignores scores and uses only positions. If a chunk appears at rank 2 in BM25 and rank 7 in embeddings, it receives points for both positions. It is simple and requires no calibration.
- **Weighted**: converts each system's scores to a common scale (0 to 1 per question) and combines them with a weight α: `α × score_BM25 + (1−α) × score_embeddings`. With α=0.5 both systems weigh equally; with α=0.75 BM25 weighs three times as much.

We evaluated both methods on the same query set as the previous round: 499 documents, 8,065 chunks, and 3,023 questions across 6 types, with known ground truth. The script is [`evaluate_hybrid.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/evaluate_hybrid.py); embeddings are cached on disk, so trying a new fusion combination takes minutes.

## Result: fusion wins

| System | MRR | Recall@1 | Recall@5 |
|---|---|---|---|
| BM25 alone | 0.616 | 0.561 | 0.687 |
| F2LLM-0.6B int8 alone | 0.561 | 0.496 | 0.646 |
| jina-v5-small binary alone | 0.538 | 0.470 | 0.631 |
| RRF(BM25, F2LLM-int8) | 0.633 | 0.572 | 0.712 |
| **W0.50(BM25, F2LLM-int8)** | **0.661** | **0.596** | **0.749** |
| W0.50(BM25, jina-binary) | 0.646 | 0.573 | 0.744 |

Reading the table in practical terms: out of every 100 questions, BM25 alone finds the correct document in first place 56 times. The best standalone embedding, 50 times. Equal-weight fusion, **60 times**, and within the top 5 it finds the document 75 times out of 100, versus 69 for BM25. That is a 4 to 10 percentage point improvement depending on the metric, without changing the model or the index—only by combining two lists we already had.

RRF also improves over both parents, but it stays about 3 points below weighted fusion. And the α curve is flat between 0.5 and 0.6, so the weight does not need to be calibrated very precisely.

### The α knob depends on the question type

The breakdown by query type (Recall@1) shows something more interesting than the average:

| Question type | BM25 | F2LLM int8 | W0.25 | W0.50 | W0.75 |
|---|---|---|---|---|---|
| factual (document terms) | 0.703 | 0.469 | 0.527 | 0.659 | 0.708 |
| paraphrase (rephrased) | 0.565 | 0.773 | **0.813** | 0.783 | 0.645 |
| thematic (citizen language) | 0.301 | 0.446 | **0.492** | 0.450 | 0.354 |

For questions that use the same words as the document (`factual`), α=0.75 is best: give more weight to BM25. For rephrased questions or citizen-language questions (`paraphrase`, `thematic`), α=0.25 is best: give more weight to embeddings. And something notable happens in `paraphrase`: fusion with α=0.25 (0.813) outperforms *both* individual systems (0.773 and 0.565). It does not just redistribute the best of each; the combination finds documents that neither found alone.

A fixed α of 0.5 is a good compromise, but it leaves 2 to 4 MRR points on the table. Recovering them requires deciding the weight per question, which points directly to the agentic system from the previous post: an LLM that classifies the question (“is this looking for an exact term or a topic?”) and adjusts the fusion, or calls each search tool as appropriate.

### Quantization survives fusion

Two data points we had already been confirming, now in the hybrid context:

- **int8 is still free**: F2LLM-int8 results are identical to fp32 on every metric. Fourth confirmation in this project.
- **binary loses less in fusion than alone**: jina-binary loses ~2 MRR points when used alone, but only ~1 point inside fusion (0.650 vs 0.662 for F2LLM-int8). BM25 exactly compensates for the cases where binarization degrades the embedding.

## Indexing 6.5 million chunks from a laptop

### What did not work: tuning PyTorch

The previous benchmark's speeds came from the sentence-transformers default configuration (batch 32, fp32). We tested whether there was headroom with a batch-size sweep (32 to 256) and fp16 in [`scripts/bench_throughput.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/bench_throughput.py). There was no headroom: the default was already optimal, larger batches *worsen* throughput (Official Journal of the Federation (DOF) chunks are long and memory is tight), and fp16 is numerically identical but equally slow. PyTorch MPS was already at its limit.

### What did work: GGUF on Metal

llama.cpp is a C++ inference engine with a native backend for Apple's GPU (Metal), different from PyTorch. Models are converted to a format called GGUF, which already exists for our two candidates: `mradermacher/F2LLM-v2-0.6B-GGUF` and the official jina GGUFs. We measured with [`scripts/bench_gguf.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/bench_gguf.py), which starts `llama-server` in embedding mode and sends it the same 1,378 chunks as the previous sweep:

| Model | PyTorch MPS | GGUF/Metal | Speedup |
|---|---|---|---|
| F2LLM-v2-0.6B | 3.74 chunks/s | 5.34 chunks/s | 1.43× |
| jina-v5-small | 2.93 chunks/s | 5.42 chunks/s | 1.85× |

Quantizing model weights to Q8_0 did not add speed (the limit is compute, not memory), so we used f16. With these numbers, full-corpus indexing drops from 20–27 days to **~14 continuous days per model** on the laptop. It is still non-trivial, but it is now a job that can be left running; renting a GPU in the cloud remains available if we want the index in hours.

### The prefix that almost silently ruins the index

Before trusting llama.cpp embeddings, we verified that they were equivalent to sentence-transformers. F2LLM came out perfect (cosine similarity 0.9993). Jina came out wrong: 0.958 on average, with cases at 0.75. If we had indexed that way, search would have degraded with no error to announce it.

The cause: sentence-transformers, without advertising it much, prepends the text `Document: ` to each chunk and `Query: ` to each question when using jina-v5 (it comes that way in the model configuration). llama.cpp knows nothing about this and embeds the text as-is. After adding the prefixes manually, agreement rose to 0.9999. The lesson was documented in the report: when indexing with the GGUF server, chunks must carry `Document: ` and queries must carry `Query: `.

## The decision: jina binary, and why it changes the architecture

With the experiments above on the table, the production configuration for the first full indexing run is:

**jina-v5-text-small with binary vectors + BM25, weighted fusion α=0.5.**

The reasoning is no longer just quality (0.650 MRR, 1.5 points below F2LLM-int8), but disk space. The [corpus storage architecture](https://github.com/CodeandoGuadalajara/dof-rag/blob/main/docs/corpus-storage-architecture.md) stores document text once, compressed with zstd, and keeps chunks as *references* (offsets) into those documents instead of copying the text again. With that design, the breakdown for the full corpus is:

| Component | Estimated size |
|---|---|
| Compressed corpus (zstd) | 2–8 GB |
| Chunk metadata (offsets, no text) | 1–2 GB |
| jina binary vectors (6.5M × 128 bytes) | **0.83 GB** |
| F2LLM int8 vectors (alternative) | 6.7 GB |

jina binary vectors take one-eighth the space of int8 and, measured inside the fusion, cost only 1.5 MRR points. That is what makes the full index fit comfortably on the laptop's disk (which currently has 19 GB free) and later on a modest server.

One final validation: the architecture proposes doing BM25 at the *document* level (over the compressed text) rather than at the chunk level as we did in the benchmark. We repeated the fusion evaluation with that granularity ([`evaluate_hybrid_doclevel.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/evaluate_hybrid_doclevel.py)) and the result holds: MRR 0.650 with jina-binary, 0.662 with F2LLM-int8. Document-level BM25 is weaker by itself (0.589), because long documents dilute the word scores, but the fusion fully compensates for the difference. The design that fits on disk does not cost quality.

## Next steps

1. **Storage proof of concept**: build the compressed corpus with sqlite-zstd over 10,000 documents, following the architecture's acceptance criteria (compression ≥8×, exact chunk reconstruction from offsets, FTS5 working over the compressed view, resumable ingestion). There we will also measure the real size of the FTS index, the only estimate still missing.
2. **Full indexing**: once the PoC is validated, run the GGUF embedder over the 657,867 documents (~14 days, with checkpoints to resume).
3. **Adaptive weight and agent**: use the α knob per question type and the metadata tools (date, type, issuer) described in the previous post.

## Code and data

- PR: [#59](https://github.com/CodeandoGuadalajara/dof-rag/pull/59)
- Scripts: [`bench_throughput.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/bench_throughput.py), [`bench_gguf.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/bench_gguf.py), [`evaluate_hybrid.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/evaluate_hybrid.py), [`evaluate_hybrid_doclevel.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/evaluate_hybrid_doclevel.py)
- Reports: [`reports/bench_throughput.md`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/reports/bench_throughput.md), [`reports/hybrid_retrieval.md`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/reports/hybrid_retrieval.md)
