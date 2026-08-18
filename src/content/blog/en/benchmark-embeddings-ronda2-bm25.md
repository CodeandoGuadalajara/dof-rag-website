---
title: "Embedding benchmark round 2: BM25, late chunking, and LLM-generated queries"
description: "Second round of the benchmark: 499 documents from the full corpus (1999–2026), 3,023 LLM-generated queries across 6 types, a BM25 baseline with FTS5, and evaluation of late chunking for pplx-embed-context. BM25 and embeddings turn out to be complementary by query type."
date: "2026-08-01"
heroImage: ""
category: "development"
tags: ["dof-rag", "embeddings", "benchmark", "bm25", "rag", "hybrid-retrieval"]
author: "Joaquín Bravo Contreras"
---

## Motivation

The [previous benchmark](/en/blog/2026/07/benchmark-embeddings-dof/) evaluated 10 embedding models on 50 documents from the Official Journal of the Federation (DOF) (2020–2024) with synthetic queries (titles and first 20 words). Three items were left pending:

1. **More documents**: 50 docs is too few to draw conclusions about a corpus of ~660k files.
2. **Late chunking**: pplx-embed-context-v1 is designed for contextual embedding, but it was evaluated chunk-by-chunk.
3. **BM25 baseline**: we still needed to compare against full-text search, which SQLite FTS5 provides for free.

This round expands to **499 documents** from the full corpus (1999–2026), generates **3,023 queries** with an LLM across 6 different types, adds **BM25** as a baseline, and evaluates **late chunking** for pplx-embed-context.

Code and reports are in PR [#58](https://github.com/CodeandoGuadalajara/dof-rag/pull/58).

## Setup

**Hardware**: MacBook Pro M3 (36 GB), MPS.

**Corpus**: `dof_md-local`, 657,867 local markdown files, 1999–2026, 61 GB. Stratified sample by year and by chunker pattern (SMALL, H2_COMPOUND, BOLD_HEADERS, PLAIN_TEXT, GIANT_TABLE) so the sample does not fill up with small AVISO notices.

**Models evaluated** (the 4 winners from round 1):

| Model | Params | Dims | Notes |
|---|---|---|---|
| [F2LLM-v2-1.7B](https://huggingface.co/codefuse-ai/F2LLM-v2-1.7B) | 1.7B | 2,048 | Best MRR in round 1 |
| [F2LLM-v2-0.6B](https://huggingface.co/codefuse-ai/F2LLM-v2-0.6B) | 0.6B | 1,024 | Best quality/size in round 1 |
| [pplx-embed-context-v1](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) | 0.6B | 1,024 | Designed for late chunking |
| [jina-v5-text-small](https://huggingface.co/jinaai/jina-embeddings-v5-text-small) | 0.6B | 1,024 | Trained with binary quantization |

**Baseline**: BM25 via SQLite FTS5, tokenizer `unicode61 remove_diacritics 1`, no stemming. MATCH with OR of terms. Over the same chunks and queries as the embeddings.

## Metrics

- **Recall@k**: proportion of queries where the correct document appears in the top-k results.
- **MRR** (Mean Reciprocal Rank): average of 1/rank of the correct document. Premise: being in position 1 is worth more than being in position 10.
- **Chunk-level Recall@k**: same as Recall@k but checks whether the exact chunk that answers the query appears in the top-k, not just the document. Only applies to queries with chunk-level ground truth.

## Round 2: 200 docs, verbatim queries

First expansion: 200 documents, 400 queries (same as round 1: titles and first 20 words, all verbatim).

| System | MRR | Recall@1 | Recall@5 |
|---|---|---|---|
| BM25 (FTS5) | 0.592 | 0.557 | 0.637 |
| F2LLM-v2-1.7B | 0.554 | 0.480 | 0.650 |
| F2LLM-v2-0.6B | 0.513 | 0.453 | 0.598 |
| pplx-embed-context | 0.451 | 0.380 | 0.545 |
| jina-v5-small | 0.415 | 0.350 | 0.500 |

BM25 came in first in MRR and Recall@1. F2LLM-v2-1.7B was the best embedding and the only one competitive with BM25 (it wins Recall@5 and Recall@10, where BM25 plateaus because it only returns documents containing the exact query terms).

The problem: verbatim queries contain the same words as the document. That is exactly what BM25 does well. To measure whether embeddings add something BM25 cannot, we needed queries with different vocabulary.

## Late chunking for pplx-embed-context

Late chunking ([Günther et al., 2023](https://arxiv.org/abs/2409.04701)): instead of embedding each chunk separately, you run a forward pass over the full document and mean-pool the token-level embeddings across each chunk's span. Every chunk embedding carries context from the whole document.

Implementation: a splitter with offset tracking (character positions), one forward pass per document (up to 32,768 tokens), mean-pooling over tokens whose offset falls inside the chunk span. Paired comparison: the same chunks encoded both ways, same queries.

| Encoding | Chunks | Recall@1 | Recall@5 | MRR | Time |
|---|---|---|---|---|---|
| Standard (chunk by chunk) | 1,451 | 0.335 | 0.510 | 0.406 | 407s |
| Late chunking (full doc) | 1,067 | 0.343 | 0.480 | 0.400 | 1,245s |

Δ MRR: −0.6 points. There was no gain and it took 3× longer.

6 giant documents (tables up to 188k tokens) exceeded the 32k limit and were truncated, losing 384 chunks (26% of the pool). Those chunks could not be embedded with context. In production you would need windowed encoding for those cases, but the absence of gain on the chunks that were processed does not motivate investing in that.

### The chunker matters more than late chunking

The late-chunking evaluation uses a simple splitter that divides text by paragraphs while respecting the token limit, with no overlap and no header prefixes. The standard branch of that evaluation (MRR 0.406) serves as a comparison point to isolate the effect of the production chunker.

The production chunker (described in the [pattern-based chunker post](/en/blog/2026/05/chunker-patron-dof/)) does two things the bare splitter does not:

1. **50-token overlap between consecutive chunks**: when a chunk ends mid-thought, the next one starts with the last 50 tokens of the previous one. If a query matches text that falls on the boundary between two chunks, both chunks contain that text and both can retrieve it. Without overlap, that text lives in only one of the two chunks and may lack enough context to match.

2. **Header prefixes**: each chunk is preceded by the header hierarchy it belongs to. For example, a chunk inside section `## MANUAL de percepciones` under `### Artículo 5` is stored as `## MANUAL de percepciones\n### Artículo 5\n\n<chunk content>`. This gives structural context to both the embedder and BM25: the chunk carries metadata about which decree and section it belongs to, without changing the chunk content.

Direct comparison: same model (pplx-embed-context), same 200 documents, same queries, same seed. Only the chunking changes.

| Chunking | MRR | Difference |
|---|---|---|
| Bare splitter (no overlap, no prefixes) | 0.406 | — |
| Production chunker (overlap + prefixes) | 0.451 | +4.5 pts |

+4.5 MRR points from changing the chunking, without changing the model. For perspective: the difference between the best embedding model (F2LLM-v2-1.7B, MRR 0.554) and the worst (jina-v5-small, MRR 0.415) in round 2 is 13.9 points. The difference between the production chunker and the bare splitter is 4.5 points — one-third of the entire variability across models.

The practical conclusion: before investing time in late chunking or testing larger models, make sure the chunking is good. Overlap and header prefixes add more than any contextual technique on top of embeddings.

## Round 3: LLM-generated queries

### Generation

We built `scripts/generate_queries.py`. For each document, it splits the text into numbered chunks, sends the chunks to an LLM with a structured prompt, and asks for questions of several types. We used Kimi k3-256k for most and DeepSeek V4 Flash for retries (499 valid docs out of 500 sampled).

**6 query types**:

| Type | Description | Ground truth | Example |
|---|---|---|---|
| `verbatim_title` | Document title | document | "MANUAL de percepciones de los servidores públicos de mando de la CNDH..." |
| `first_words` | First 20 words of chunk 0 | document (chunk 0) | "Al margen un sello con el Escudo Nacional, que dice: Estados Unidos Mexicanos..." |
| `paraphrase` | Topic rephrased, without copying 5+ consecutive words from the doc | document | "Esquema de remuneraciones y beneficios aplicable al personal directivo del organismo defensor de derechos humanos" |
| `thematic` | Citizen question without legal jargon | document | "¿Cuánto ganan y qué prestaciones reciben los altos funcionarios de la CNDH?" |
| `factual` | Specific question answerable by a chunk | **chunk** | "¿En qué grado está clasificado el puesto de Presidente de la CNDH?" (chunk 4) |
| `article_specific` | "What does article X of… establish?" | **chunk** | "¿Qué establece el artículo transitorio décimo del Decreto 317?" (chunk 5) |

Programmatic validation: 5-gram overlap filter for paraphrase/thematic (they cannot copy 5 consecutive words from the document), deduplication, chunk-index verification, question formatting. Queries of types `factual`, `article_specific`, and `first_words` are annotated with the exact chunk that answers them.

Total: **499 documents, 3,023 queries, 1,618 with chunk-level ground truth**. The dataset is versioned in `eval/dof_queries_v2.jsonl` and is reusable for future evaluations.

### Overall results

| System | MRR | Recall@1 | Recall@5 | Recall@10 |
|---|---|---|---|---|
| BM25 (FTS5) | 0.616 | 0.561 | 0.687 | 0.728 |
| F2LLM-v2-1.7B | 0.595 | 0.534 | 0.677 | 0.725 |
| F2LLM-v2-0.6B | 0.561 | 0.495 | 0.647 | 0.707 |
| pplx-embed-context | 0.559 | 0.493 | 0.647 | 0.716 |
| jina-v5-small | 0.558 | 0.493 | 0.645 | 0.697 |

BM25 still leads in overall MRR, but its advantage over F2LLM-v2-1.7B dropped from +3.8 points (round 2) to +2.1 points (round 3). Embeddings improved relatively with more diverse queries because some questions use vocabulary that does not appear in the document.

### Results by query type

This table shows Recall@1 (proportion of queries where the correct document appeared in first place) broken down by type. This is where the real difference between BM25 and embeddings shows:

| Query type | n queries | BM25 R@1 | F2LLM-1.7B R@1 | Observation |
|---|---|---|---|---|
| first_words (verbatim) | 499 | 0.876 | 0.770 | BM25: the words are in the doc |
| factual (doc vocabulary) | 1,009 | 0.703 | 0.484 | BM25: exact terms |
| article_specific | 110 | 0.482 | 0.291 | BM25: "artículo X" appears literally |
| paraphrase (other words) | 428 | 0.565 | 0.832 | Embeddings: understand meaning |
| thematic (citizen jargon) | 478 | 0.301 | 0.521 | Embeddings: different vocabulary |
| verbatim_title | 499 | 0.222 | 0.212 | Both fail: duplicate titles |

**BM25 wins when the query uses the same words as the document.** In `factual` and `first_words`, the questions contain terms that appear literally in the decree ("Licitación Pública Nacional Electrónica", "artículo 5"). BM25 finds those through text matching.

**Embeddings win when the query rephrases the topic.** In `paraphrase` and `thematic`, the questions use vocabulary that is not in the document. "¿Cuánto ganan los altos funcionarios de la CNDH?" does not contain the words "MANUAL", "percepciones", or "servidores públicos de mando" that appear in the decree. Embeddings capture the semantic relationship; BM25 does not.

**`verbatim_title` is hard for both.** Recall@1 of 0.22. The 28-year corpus has thousands of decrees with almost identical titles that repeat every year ("AVISO de licitación pública nacional...", "ACUERDO por el que se emiten..."). A title alone cannot distinguish a document from its dozens of annual siblings. Neither BM25 nor embeddings can resolve which one is correct.

### Chunk-level: is the exact chunk retrieved?

Queries of types `factual`, `article_specific`, and `first_words` (1,618 total) are annotated with the specific chunk that answers them. This metric checks whether that chunk appears in the top-k, not just the document:

| System | n queries | R@5 chunk | MRR chunk |
|---|---|---|---|
| BM25 (FTS5) | 1,618 | 0.798 | 0.696 |
| F2LLM-v2-1.7B | 1,618 | 0.643 | 0.536 |
| pplx-embed-context | 1,618 | 0.635 | 0.521 |
| jina-v5-small | 1,618 | 0.625 | 0.511 |
| F2LLM-v2-0.6B | 1,618 | 0.600 | 0.500 |

BM25 also wins at the chunk level (0.798 vs 0.643 in R@5). The difference from the document-level metric is that embeddings sometimes retrieve the correct document but the wrong chunk within that document. For RAG this matters: the generative model only sees the retrieved chunks, not the full document, so returning the wrong chunk from the right doc produces incorrect answers.

## Quantization

Same post-hoc variants as round 1, over the same fp32 embeddings. Δ MRR relative to the fp32 baseline:

| Model | int8 | binary (1 bit/dim) | mrl_768 (truncated) |
|---|---|---|---|
| pplx-embed-context | +0.0 pts | -4.5 pts | -0.6 pts |
| F2LLM-v2-1.7B | -0.0 pts | -1.7 pts | -0.7 pts |
| F2LLM-v2-0.6B | +0.0 pts | -4.4 pts | -0.8 pts |
| jina-v5-text-small | +0.1 pts | -2.0 pts | -0.7 pts |

Three rounds, same int8 result: no quality loss on any model. But there is an important change for binary compared with round 1:

**jina's binary advantage reversed with harder queries.** In round 1 (50 docs, verbatim queries) jina was the only model that *improved* when binarized (+0.5 pts). In round 2 it lost 0.7 pts, and in this round it loses 2.0 pts. It remains the 0.6B model that degrades least with binary (vs −4.4 for F2LLM-0.6B and −4.5 for pplx), but binarization is no longer free even for jina. Curiously, the least degradation in this round is F2LLM-v2-1.7B (−1.7 pts), although having 2,048 dims doubles the bytes per binary vector (256 B vs 128 B).

Truncating to 768 dims costs ~1 point uniformly across all models.

## Estimates for the full corpus

The `dof_md-local` corpus has 657,867 documents. To estimate the total number of chunks, we sampled 300 documents at random (seed 123) and processed them with the production chunker: average of **9.9 chunks per document** (median 2; the long tail is giant tables and decrees made up of hundreds of pages). Estimated total: **~6.5 million chunks** (95% confidence interval: 4.5M–8.5M). This is much higher than the ~1M in the previous post, which corresponded to the 2020–2024 subset.

### Embedding time (MacBook Pro M3, MPS, chunks/s from round 1)

| Model | chunks/s | Estimated time (6.5M chunks) |
|---|---|---|
| F2LLM-v2-0.6B | 3.7 | ~490 h ≈ **20 days** |
| pplx-embed-context | 3.2 | ~565 h ≈ 24 days |
| jina-v5-text-small | 2.8 | ~645 h ≈ 27 days |
| F2LLM-v2-1.7B | 1.7 | ~1,060 h ≈ **44 days** |

Full-corpus indexing is done once, but re-indexing with another model costs the same. The difference between F2LLM-0.6B and F2LLM-1.7B is 24 extra days of compute for 3.4 MRR points.

### Vector storage (6.5M chunks)

| Format | 0.6B models (1,024 dims) | F2LLM-1.7B (2,048 dims) |
|---|---|---|
| fp32 | 27 GB | 53 GB |
| **int8** | **6.7 GB** | **13.3 GB** |
| binary | **0.83 GB** | 1.67 GB |

Not including chunk text or the FTS5 index (the source corpus is 61 GB of markdown). With int8, vectors for the chosen 0.6B model add ~7 GB — manageable on the production server. With binary it would be <1 GB, but at the cost of 2–4.5 MRR points depending on the model.

### Throughput improvement headroom

The reported speeds (1.7–3.7 chunks/s) are with the default sentence-transformers setup: batch 32, fp32, MPS, not tuned for the M3. Before running full indexing (~6.5M chunks, 20–44 days at these speeds) an optimization sprint is worthwhile. Known paths, from least to most effort:

1. **Batch size and dtype**: the benchmark used batch 32 in fp32 by default, not because it was optimal. A sweep of batch sizes (64/128/256) and fp16 on MPS typically yields 1.5–3× on Apple chips. Script ready to measure: [`scripts/bench_throughput.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/scripts/bench_throughput.py).
2. **Native Apple Silicon ports**: [MLX](https://github.com/ml-explore/mlx) or GGUF with [llama.cpp](https://github.com/ggml-org/llama.cpp) (Metal backend, with int8/q4 weight quantization) are usually faster than PyTorch MPS for inference on Mac. Qwen3-Embedding already has official GGUFs; F2LLM would need conversion.
3. **Cloud GPU for the one-time indexing**: full indexing is a one-shot job. A rented A100/H100 (vast.ai, RunPod) with batch 512 would process ~6.5M chunks in hours instead of weeks, for tens of dollars. The resulting vectors are copied to the production server.

## Speed vs quality

![Embedding speed vs MRR for the 4 finalist models and the BM25 reference line](/images/posts/benchmark-embeddings/pareto_round2.svg)

*Speed data is from round 1 (same hardware, same models). Quality (MRR) is from round 3: 499 documents, 3,023 queries. The red dashed line is BM25 (MRR 0.616), which has no embedding speed because it does not generate vectors — it is instant text search. The gray line is the Pareto frontier: the two models not dominated by another on both axes.*

**F2LLM-v2-1.7B and F2LLM-v2-0.6B are on the Pareto frontier.** The other two (pplx-context and jina-v5-small) are dominated: they are slower than F2LLM-v2-0.6B but do not improve quality. The real choice is between the two F2LLMs.

The quality gap between them is 3.4 MRR points (0.595 vs 0.561). The speed gap is 2.2× (1.7 vs 3.7 chunks/s), which at full-corpus scale means ~44 days of embedding vs ~20 days on the M3 Mac. The storage gap is 2× (2,048 vs 1,024 dims → 13.3 GB vs 6.7 GB of int8 vectors for ~6.5M chunks). The question is whether 3.4 MRR points justify 24 days of compute and 6.6 GB more.

Given that BM25 already wins in overall MRR (0.616) and the plan is hybrid retrieval (where embeddings cover the semantic case, not the general case), the marginal advantage of 1.7B over 0.6B is less critical. F2LLM-v2-0.6B is the pragmatic candidate: same storage cost as pplx and jina, but faster and marginally better in quality. However, the difference among the three 0.6B models (0.558–0.561) is within statistical noise with 3,023 queries — the final decision may depend on factors outside this benchmark (ease of deployment, ONNX support, ecosystem).

## Conclusions

1. **BM25 is competitive and complementary.** It won overall MRR in all three rounds. But the breakdown by type shows it wins when there is lexical overlap and loses when the query rephrases the topic. A RAG system over the DOF needs both: BM25 for searches with exact terms, embeddings for semantic searches.

2. **Late chunking did not help on this corpus.** pplx-embed-context with full-document encoding did not improve over chunk-by-chunk encoding (Δ MRR −0.6 pts). Context from the full document did not add useful information for DOF chunks, which tend to be self-contained. The chunker (overlap + prefixes) contributed more than late chunking.

3. **The chunker matters as much as the model.** The MRR difference between the best and worst embedding model is ~4 points. The production chunker adds ~4.5 points over a basic splitter. Chunking quality is as important as model choice.

4. **Evaluation queries matter more than models.** With verbatim queries, BM25 looked infinitely superior. With LLM-generated queries that include rephrasings, embeddings closed the gap. An evaluation whose queries only copy text from the document measures string matching, not semantic retrieval.

5. **int8 is still free.** Three rounds confirm that int8 quantization loses no quality on any model. For production: sqlite-vec with int8 vectors.

6. **Structural metadata is necessary, not optional.** `verbatim_title` has Recall@1 of 0.22 for all systems. The 28-year corpus has thousands of decrees with almost identical titles that repeat annually ("AVISO de licitación pública nacional...", "ACUERDO por el que se emiten..."). Neither BM25 nor embeddings can distinguish a document from its dozens of annual siblings using text alone. The difference between those documents is not in the content — it is in the date, issuer, type, and reference number. That metadata already exists in the DOF file paths, but no text-only search system exploits it.

## Code and data

- Scripts: [`evaluate_retrieval.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/scripts/evaluate_retrieval.py), [`generate_queries.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/scripts/generate_queries.py), [`evaluate_late_chunking.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/scripts/evaluate_late_chunking.py) (PR [#58](https://github.com/CodeandoGuadalajara/dof-rag/pull/58))
- Query set: [`eval/dof_queries_v2.jsonl`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/eval/dof_queries_v2.jsonl) — 499 docs, 3,023 queries, 1,618 with chunk-level GT
- Retrieval report: [`reports/retrieval_evaluation.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/reports/retrieval_evaluation.md)
- Late chunking report: [`reports/late_chunking_evaluation.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/benchmark-round2/reports/late_chunking_evaluation.md)

## Next steps

### Hybrid retrieval

Fuse BM25 and vector rankings (RRF or weighted fusion). The breakdown by type suggests the combination should win across all types: BM25 covers factual/first_words, embeddings cover paraphrase/thematic.

### Agentic RAG with search tools and metadata

These benchmark results suggest that a search system based only on text (whether BM25 or embeddings) has a ceiling. Conclusion 6 indicates that `verbatim_title` fails because the difference between duplicate documents lies in metadata, not content. And the breakdown by type shows that BM25 and embeddings are complementary depending on query type.

An agentic RAG system — an LLM with search tools that can decide what to use and in what order — addresses both problems:

**DOF metadata**: every document already has structural information in its file path:

```
2023/03/22032023/MAT/093_AVISO_20230322_MAT_5646395.md
      │  │        │   │   │      │
      │  │        │   │   │      └── numeric reference
      │  │        │   │   └── type (AVISO/ACUERDO/DECRETO/NORMA/...)
      │  │        │   └── number
      │  │        └── section (MAT/VESPER/EXT)
      │  └── publication date
      └── year
```

An agent can filter by these attributes **before** running text or vector search. For a query like "what did the DOF say about support for fishermen in 2023?", the agent filters by year and then searches semantically — the candidate pool drops from 660k to the 2023 docs, and embeddings no longer have to compete with 2005 decrees saying the same thing.

**Candidate tools**:

| Tool | What it does | Solves |
|---|---|---|
| `search_by_date(date_or_range)` | Filters documents by publication date | Duplicate titles across years |
| `search_by_type(type)` | Filters by AVISO/ACUERDO/DECRETO/NORMA | Reduces candidate pool |
| `search_by_institution(issuer)` | Filters by issuing body | Queries about a specific institution |
| `vector_search(query, filters, top_k)` | Semantic search with metadata filters | Paraphrase/thematic |
| `fts_search(query, filters, top_k)` | BM25 with metadata filters | Factual/exact-term |
| `get_document(doc_id)` | Retrieves full text | Navigation inside the doc |
| `get_chunk(doc_id, chunk_index)` | Retrieves a specific chunk | Chunk-level precision |

SQLite already supports this: FTS5 with `UNINDEXED` metadata columns in `WHERE`, and sqlite-vec can be combined with metadata in the same SQL query. No additional infrastructure is needed — it is the same SQLite we already plan to use.

**Example flow**:

```
User: "what did the DOF say about support for fishermen in 2023?"

Agent:
  1. search_by_date(2023)          → filters pool to 2023 docs
  2. vector_search("apoyos pescadores", filters={year:2023})
     → embeddings find docs even if they do not literally say "pesca"
  3. fts_search("pesca huracán apoyo", filters={year:2023})
     → BM25 finds docs with exact terms
  4. if too many results → search_by_type("ACUERDO")
  5. get_chunk(doc_id, chunk_3)    → reads the specific chunk
  6. synthesizes answer with context
```

This goes beyond hybrid retrieval. Hybrid fuses two rankings; an agent with tools can **pre-filter by metadata before searching**, which directly attacks the `verbatim_title` problem that no embedding model or BM25 can solve alone.

### Scale the evaluation

More documents and queries once the production model is chosen. 499 docs is enough to compare models, but not to measure degradation at scale.

### Production decision

With these results, the candidate is F2LLM-v2-0.6B (quality/cost) + FTS5 as a fixed component + int8 for vectors.
