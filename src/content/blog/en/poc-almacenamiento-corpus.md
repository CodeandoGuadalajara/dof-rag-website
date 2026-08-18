---
title: "Storing 31 GB of Text in 3 GB (and Recovering Every Byte): the Storage Proof of Concept"
description: "Fourth installment of the benchmark: we built the compressed corpus on 10,000 real documents. sqlite-zstd compresses 10.9x with random access, chunks are stored as 110-byte recipes instead of text, the word-search index ended up 15x smaller than feared, and TurboQuant quantization ties full-vector quality. Everything fits in ~11 GB."
date: "2026-08-03"
heroImage: ""
category: "development"
tags: ["dof-rag", "storage", "sqlite", "zstd", "fts5", "vector-search", "benchmark"]
author: "Joaquín Bravo Contreras"
---

## Motivation

The [previous post](/en/blog/2026/08/benchmark-hibrido-m3-gguf/) ended with a decision and a debt. The decision: hybrid search with jina-v5-text-small + BM25, weighted fusion α=0.5. The debt: demonstrate that the [storage architecture](https://github.com/CodeandoGuadalajara/dof-rag/blob/main/docs/corpus-storage-architecture.md) works for real.

Recall the problem. The corpus is 657,867 Markdown files, 31.47 GiB of text. An fp32 vector matrix for the ~5 million chunks is another 20.8 GiB. If on top of that we store the text of each chunk next to its vector (as most RAG demos do), that's another 33–40 GiB. The laptop running the project has 19 GB free. The numbers don't add up, and yet we want a complete system: text, word search (BM25), and vector search.

The proposed architecture has three ideas: store the text once compressed with zstd, store chunks as *references* inside documents instead of copying the text, and quantize the vectors. This post reports the proof of concept (PoC) on 10,000 real documents chosen at random, with measurable acceptance criteria defined up front. Complete code and numbers are in PR [#61](https://github.com/CodeandoGuadalajara/dof-rag/pull/61) and in `docs/corpus-storage-poc-results.md`.

## Idea 1: Compress the corpus, but with random access

Compressing 31 GB of text is not the hard part; the hard part is compressing it and being able to read *one* document in milliseconds without decompressing everything. A `.tar.zst` file compresses very well, but you have to scan the whole thing to extract one file.

[sqlite-zstd](https://github.com/phiresky/sqlite-zstd) solves this: each row (document) is compressed individually with [Zstandard](https://facebook.github.io/zstd/), so reading a document only decompresses that document. The extra trick is **dictionaries**: zstd can train a dictionary with the repeated patterns of a set of texts and use it when compressing each row. The Official Journal of the Federation (DOF) is the ideal case for dictionaries because it shares repeated formulas across all documents:

```
Al margen un sello con el Escudo Nacional, que dice:
Estados Unidos Mexicanos.- Secretaría de ...
```

That header (and dozens of variants of signatures, notices, and date formats) appears in hundreds of thousands of documents. Without a dictionary, each document would pay to compress it; with a dictionary, it compresses to a few bytes of reference. We trained a dictionary per publication year.

The "transparent" mode of sqlite-zstd turns the table into a view: the application runs `SELECT markdown FROM documents WHERE ...` and receives plain text, unaware that below there are compressed blobs. That lets us build everything else (indexes, text search) as if it were a normal database.

### Result

| zstd level | Database | Compression | Maintenance time |
|---|---:|---:|---:|
| 3 (fast) | 43.9 MiB | **10.92x** | 11 s |
| 19 (maximum) | 35.5 MiB | **13.51x** | 47 s |

The 479.8 MiB sample fits into 44 MiB. Extrapolated to the full corpus: **2.3–2.9 GiB**, at the low end of the 2–8 GiB range the architecture estimated. The acceptance criterion required at least 8x.

What about readback? The criterion asked for p95 below 50 ms to read and decompress a document. We measured **0.15 ms** p95 over 500 random reads: three hundred times faster than the target. Row-level zstd decompression is not a bottleneck, not even close.

The important check is not speed but correctness: we read all 10,000 documents from the compressed database and compared the sha256 of each one against the original file. **10,000 out of 10,000 identical**, including one 71.5 MiB document that we stored segmented (documents larger than 32 MiB are split into ordered segments so we don't decompress complete giants into memory).

## Idea 2: Chunks without text — 110-byte recipes

This is the most interesting part of the design. A chunk of 800 tokens is ~2.5 KB of text. With 5 million chunks, storing each chunk's text duplicates the corpus. The architecture says: store only *offsets* (start, end) within the document, and at query time slice the text.

The problem is that our [chunker](/en/blog/2026/08/chunker-patron-dof/) does not cut the document into clean slices. Before chunking, it transforms the text:

1. Converts comments `<!-- IMAGE_DESCRIPTION: ... -->` into text paragraphs.
2. Removes boilerplate headers (`## Al margen un sello...`).
3. When splitting a long section, prepends the header to each part: `## SENTENCIA ...\n\n` + the corresponding part.
4. Joins paragraphs with synthetic separators and repeats ~50 tokens of overlap between consecutive chunks.

So a chunk **is not a substring of the document**: it is an assembly of pieces of the normalized text with synthetic text interleaved. A simple (start, end) offset is not enough.

The solution: instead of a pair of offsets, each chunk stores a **recipe**: a list of slices of the normalized text interleaved with short literals. Real simplified example:

```json
[[66, 261], {"l": "\n"}, [262, 2891]]
```

It reads like this: take characters 66–261 from the normalized text (the section header), add a literal `"\n"` (the extra separator the chunker inserts), then characters 262–2891 (the content of the part). Concatenated, it is exactly the chunk text.

"Normalized text" is the document text after applying the deterministic transformations from steps 1 and 2 — the same ones the chunker applies before chunking. At query time it is recomputed in memory (one regex pass, ~0.4 ms) and never saved to disk.

### What it took to align this

Generating a chunk's recipe is an alignment problem: finding from which slices of the normalized text each piece of the chunk came. It sounds easy until Mexican legal text appears: agrarian judgments repeat entire paragraphs word for word ("...se concedió en vía de dotación de ejido, al poblado...") across dozens of sections in the same document, and tables repeat almost identical rows. A naive aligner anchors on the wrong copy and derails.

The solution combined three rules: search each chunk within its *section* (H2 headers delimit the territory and repetition between sections stops getting in the way), anchors that don't cross line breaks (line separators are synthetic), and a proximity rule by levels (a candidate 2 KB from the cursor needs little match; a far one needs a lot of match).

Result: 98.7% of the 101,351 chunks ended up as pure recipes averaging **110 bytes** (vs ~2.5 KB of text). The remaining 1.31% — made of almost identical sentences where alignment is genuinely ambiguous — store their literal text inside the recipe. Reconstruction is exact in both cases: every recipe is verified against the chunk's sha256 when building and when reading.

The end-to-end test: take 500 random chunks, simulate the full query path (fetch the document from the compressed database, decompress, normalize, apply the recipe) and verify the hash: **500/500 correct, p95 of 6.4 ms** per chunk. Storing chunk text would have cost ~250 MB for the sample; the recipes cost 10.7 MB.

## Idea 3: The word index turned out 15 times smaller than feared

For BM25 we use FTS5, SQLite's full-text search engine, in *external content* mode: the index only stores the positions of each word (postings), not the text — the text lives in the compressed table and FTS queries it when needed. That said, there is a technical detail: because transparent compression turns the table into a view, and views have no `rowid`, you have to declare the identifier explicitly (`content_rowid='document_id'`) when creating the index.

The missing number to measure was the size of this index. An earlier measurement with a *contentful* FTS (which does duplicate the text) had given 1.36 times the text size — if that had repeated, the index alone would have cost ~43 GiB and the whole design would have collapsed.

Real result with external content: **43.2 MiB for 479.8 MiB of text, i.e. 0.09x**. Fifteen times smaller than the earlier measurement.

The difference is explained because the index only stores postings, and the DOF vocabulary is dominated by shared boilerplate: once "Escudo Nacional" is indexed the first thousand times, the next hundred thousand are cheap entries in a list that already exists. Extrapolated: ~2.8 GiB for the full corpus.

The index builds in 4 seconds over the compressed view and BM25 queries (including `snippet()` to show fragments with context) work without touching the decompression pipeline manually.

## Idea 4: 4-bit vectors that recover just as well as 32-bit ones

Quantization converts each dimension of the vector from 32 bits to 4, 3, or 2 bits. At 4 bits, a 1,024-dimension vector goes from 4,096 to **524 bytes** (7.8x less). The obvious question: how much quality is lost?

We measured with [sqlite-vector](https://github.com/sqliteai/sqlite-vector), a SQLite extension with SIMD scanning and TurboQuant 2/3/4-bit quantization, using the real embeddings from the benchmark (8,065 chunks, 3,023 questions, ground truth = exact fp32):

| Mode | Recall@10 | Recall@50 | ms/query | Bytes/vector |
|---|---:|---:|---:|---:|
| Exact scan | 0.992 | 0.997 | 8.7 | 4,096 |
| TurboQuant 4-bit | 0.953 | 0.966 | 2.1 | 524 |
| TurboQuant 3-bit | 0.924 | 0.939 | 3.8 | 396 |
| TurboQuant 2-bit | 0.866 | 0.890 | 0.8 | 268 |

In isolation, 4-bit loses ~4 recall points. That could hurt, except the production system doesn't use vectors alone: it uses fusion with BM25. And there the same thing happened as in the previous post with binary quantization, but stronger. The MRR table with weighted fusion α=0.5, measured with the real extension (not a numpy simulation):

| System (α=0.5) | MRR | Recall@1 |
|---|---:|---:|
| **jina TurboQuant4** | **0.656** | 0.581 |
| jina fp32 | 0.656 | 0.584 |
| jina TurboQuant3 | 0.654 | 0.579 |
| jina binary (previous plan) | 0.649 | 0.574 |
| F2LLM-int8 (quality option) | 0.662 | 0.594 |

**Exact tie with fp32.** The fusion fully absorbs the quantization loss: when TurboQuant gets a candidate's order wrong, BM25 almost always has it right, and vice versa. It also beats the previous plan (binary vectors with sqlite-vec, 0.649), so TurboQuant4 becomes the default option: roughly the same space as binary, better quality, and an actively maintained extension.

Extrapolated to ~5.1 million chunks: **~2.5 GiB** of vectors and ~1.3 seconds per full-scan query — acceptable for the initial user volume; if latency matters later, the architecture already considers ANN engines (pgvector, LanceDB, Qdrant).

## The final tally

| Component | Full-corpus estimate | Basis of estimate |
|---|---:|---|
| Compressed corpus | 2.3–2.9 GiB | 13.51x / 10.92x measured |
| FTS5 index (document BM25) | ~2.8 GiB | 0.09x measured text |
| Metadata and chunk recipes | ~2.8 GiB | 43 MiB per 10k docs |
| TurboQuant4 vectors | ~2.5 GiB | 524 B × 5.1M |
| **Total** | **~11 GiB** | |

Versus ~75 GiB for the naive design (text + chunk text + fp32 vectors), and it fits in the laptop's 19 GB of free space with room for the production index and backup databases.

## What we learned along the way

- **sqlite-zstd doesn't publish binaries for macOS ARM**, so we compiled it locally (23 seconds with the Rust toolchain via mise). A minimal patch was needed: the extension validates that the SQLite runtime version is at least its header version (3.49), but the project's Python links SQLite 3.47. We lowered the validation floor to 3.34, which is what the code actually needs.
- `PRAGMA auto_vacuum=FULL` has to be declared *before* switching to WAL mode; otherwise, SQLite silently ignores it.
- zstd dictionary training fails with a few huge rows (the 25 MiB segments of the giant document). Documented solution: `'[nodict]'` for that table — with 3 rows a dictionary wouldn't have helped anyway.
- Ingestion is truly resumable: we killed the process with `kill -9` mid-compression and when relaunched it continued without losing or corrupting anything (each document is upserted by unique path, in transactions of 256).

## Caveats and next steps

Two licenses require review before production: sqlite-vector uses a variant of Elastic License 2.0 (the project is MIT, which apparently satisfies the open-source clause, but it needs review for service use) and sqlite-zstd is LGPL-3.0. Moreover, sqlite-zstd's own author warns not to trust it without backups — the original Markdown tree remains the source of truth; the SQLite database is a derived artifact that can be rebuilt.

What's next:

1. **Build the full corpus**: 657,867 documents with this same pipeline (the 10k sample took ~6 minutes of ingestion + chunking; scaling is a matter of hours, not days).
2. **Embedding indexing**: ~14 days of continuous compute with the GGUF/Metal server from the previous post, now with the `Document: `/`Query: ` prefixes that jina requires.
3. License review and, if user volume justifies it, the PostgreSQL + pgvector prototype that the architecture leaves as plan B.
