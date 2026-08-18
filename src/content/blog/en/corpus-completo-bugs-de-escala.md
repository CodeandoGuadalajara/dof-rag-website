---
title: "657,867 documents later: the full corpus in 3.5 GB, 6.7 million chunks, and the bugs that only appear at real scale"
description: "We built the production foundations on the 657,867 documents of the Official Journal of the Federation (DOF): the full compressed corpus occupies 3.52 GiB, the chunk index holds 6.73 million 91-byte recipes, and the binary-vector pilot confirms the vector index will fit in less than 1 GiB. Along the way: a GROUP BY that consumed 35 GB of disk, a document that became 21 GB of chunks, and a lesson in result parity."
date: "2026-08-04"
heroImage: ""
category: "development"
tags: ["dof-rag", "storage", "sqlite", "zstd", "chunking", "vector-search", "embedding"]
author: "Joaquín Bravo Contreras"
---

## From sample to full corpus

The [previous post](/en/blog/2026/08/poc-almacenamiento-corpus/) closed with a to-do list: the proof of concept on 10,000 documents had passed all its acceptance criteria, and the remaining work was to build the production foundations on the 657,867 documents of the DOF corpus. That is what we did. This post tells what worked the same as in the sample, what broke when scaling 65×, and why we changed the vector plan along the way. Code and numbers are in PR [#62](https://github.com/CodeandoGuadalajara/dof-rag/pull/62) and in `docs/full-corpus-build.md`.

Results first:

| Component | Result | Prior estimate |
|---|---:|---:|
| Compressed corpus (zstd L3) | **3.52 GiB** (8.9×) | 2.9 GiB |
| Chunk index (recipes, no text) | **2.68 GiB**, 6,730,304 chunks | ~2.8 GiB |
| Binary vectors (measured in pilot) | 151 B/vector | ~0.94 GiB total |
| Documents verified byte for byte | 300/300 against the original tree | — |
| Verified chunk reconstruction | 500/500 identical hashes | — |

## Before building: preparing the schema for other sources

One conclusion from the earlier analysis: almost everything needed to add non-DOF sources (the constitution, state laws) is incremental, **except** a schema change that becomes more expensive afterward. The compressed table does not support `ALTER TABLE` (sqlite-zstd turns it into a view; migrating means rebuilding), so the `source` column had to go in now or never.

Two design details worth explaining:

- **Dictionaries by source and year.** sqlite-zstd decides which dictionary to use with a SQL expression (`dict_chooser`). Previously it grouped by year (`year_1999`); now it groups by source and year (`dof_1999`), so when the constitution arrives it will train its own dictionaries instead of "diluting" the DOF's. Changing the expression is safe: on decompression, each row already stores the id of the dictionary it was compressed with.
- **Paths with namespaces.** Ingestion is idempotent by `documents.path` (if you re-run it, already inserted rows are skipped). To keep that working with multiple sources, future paths are prefixed with the source (`constitucion/...`); the DOF keeps its historical paths.

## Change of plans: binary vectors instead of TurboQuant

The PoC had settled on TurboQuant4 (4 bits per dimension) as the main path: quality identical to fp32 after hybrid fusion. But when we ran the numbers for the full corpus we hit a practical blocker: TurboQuant is applied with sqlite-vector's `vector_quantize`, which **requires the fp32 vectors already stored on disk**. For 6.7 million chunks of 1,024 dimensions that is ~27 GiB — it does not fit on this laptop's disk.

The alternative was already validated as plan B: sign-based binary quantization (each dimension becomes 1 bit: positive or negative). The measured quality gap is ~1 MRR point in hybrid fusion (0.649–0.650 vs. 0.656), but it has two decisive advantages:

1. **It never touches the disk in fp32.** `sign()` is applied in memory inside the embeddings pipeline; the only thing written is the 128-byte blob (1,024 bits). Zero fp32 vectors stored, zero later quantization step.
2. **Search is the cheapest there is.** Comparing two binary vectors is XOR + popcount (Hamming distance): hardware doing exactly what it does best.

Before committing ~14 days of compute we ran a pilot with 101,351 real chunks:

| Verification | Result | Extrapolated to 6.7M chunks |
|---|---:|---:|
| Vector database (sqlite-vec `bit[1024]`) | 151 B/vector | **0.94 GiB** |
| Hamming scan (k=50) | 5.0 ms/query | ~0.33 s/query |
| Re-embed a chunk and compare bits | max. 1 bit different out of 1,024 | — |

The last row deserves explanation: we re-embedded 64 chunks and compared them bit by bit against what was stored. At most 1 bit differed (rounding at the sign boundary when a dimension falls almost at zero). That proves the full path — reconstructing text from the recipe, `Document: ` prefix, GGUF server, bit packing — writes exactly what it should.

The pipeline is also resumable by design, because 14 days of continuous compute **will** be interrupted: chunks are processed in order of `chunk_id`, each batch is a transaction, and on resume it continues after the existing `MAX(chunk_id)`. A `vector_meta` table stores model, prefixes, and packing format; if you try to resume with a different configuration, the process refuses rather than silently mixing incompatible embeddings.

## Bug 1: the GROUP BY that ate 35 GB of disk

Full-corpus ingestion was boring, which is the best thing you can say about an ingestion: 657,867 documents in 428 seconds (~1,540 docs/s, same as in the PoC). The interesting part came when compressing.

sqlite-zstd maintenance (training dictionaries and compressing pending rows) failed twice with `SQLITE_FULL` ("database or disk is full"), even though `df` showed tens of GB free. Watching the filesystem while it ran revealed the culprit: a temporary `etilqs_*` file growing past 24 GB.

Where did it come from? The maintenance query that enumerates pending work is, simplified:

```sql
SELECT printf('%s_%d', source, year) AS grupo, count(*), sum(length(markdown))
FROM _documents_zstd WHERE _markdown_dict IS NULL
GROUP BY grupo;
```

A `GROUP BY` on an unindexed expression forces SQLite to sort the rows: it materializes the records in an on-disk temporary B-tree. At 10,000 documents that was a few hundred MB and nobody noticed; with 31.5 GiB of uncompressed text, the temporary file is the size of the full corpus. The disk filled up, SQLite reported "full", and the error message did not mention temporaries.

The solution has two parts:

1. **An expression index** on the internal table that matches the `dict_chooser` expression exactly: `CREATE INDEX ... ON _documents_zstd(_markdown_dict, printf('%s_%d', source, year))`. With the index, the `GROUP BY` reads the rows already ordered and the temporary file disappears — the same query went from "filling the disk in 3 minutes" to 66 seconds with no temporaries.
2. **Train the dictionaries ourselves**, with year-indexed queries (`WHERE year = 2011`), instead of letting the extension do a full scan for each group. This also resolved another latent limit: training sampling stores *all* rows of a group, and the 2011 group (2.35 GiB) exceeds the 2 GB maximum that ZDICT accepts. We control the size of the reservoir (reservoir sampling: keep *N* elements uniformly chosen from a stream without knowing its total size) and cap it at 1.8 GiB.

With that, full maintenance took ~6 minutes and the database shrank incrementally from 32 GiB to **3.52 GiB**. The generic lesson: query plans that are harmless at test scale (sorts that spill to disk, group scans) are the first to break at real scale, and it is worth looking at the `EXPLAIN QUERY PLAN` of any query that touches the whole table — including those written by your dependencies.

## Bug 2: the document that became 21 GB of chunks

Chunking ran at ~44 docs/s for hours until it froze solid: 99% CPU, zero progress, on document 129,449 — a 6.2 MiB December 2004 edition. Sampling the process stack showed one tokenizer call after another: it was not one slow call, it was hundreds of thousands of fast calls (233,272 in 90 seconds, and counting).

The mechanism, piece by piece:

1. The document is one of the old ASCII tables (`+---+` borders), and the chunker detects the first two lines as the table "header" to repeat in each chunk.
2. Those two lines measure 66 KB of dashes and plus signs: the header alone exceeds the 800-token budget, leaving `max_row_tokens` **negative**.
3. With a negative budget, every data row "exceeds the limit," and the `_force_split` binary search converges to **single-character** pieces.
4. Each single-character piece is saved as a chunk with the 66 KB header prepended.

Result: **519,113 chunks from a single document**, **21 GB of chunk text from 6.2 MB of input** — a 3,200× amplification. The bug had always been there; no document in the 10k sample had simply triggered it.

The fix is a guard: if the "header" consumes the entire token budget, it is treated as if there were no header. The same document now produces 195 healthy chunks in 4 seconds.

We took the opportunity to address the cost that made it slow: the chunker counted tokens by calling the tokenizer once per row/paragraph, with Python overhead per call. We moved counting to batches (the internal Rust tokenizer's `encode_batch`, verified to produce identical values), memoized overlap recounts, and parallelized row force-splits (the Rust tokenizer core releases the GIL, so threads actually scale).

### The golden rule: exact parity

Any change to the chunker changes the chunks, and the embeddings and evaluations already built depend on them. That is why the condition for accepting these optimizations was **bit-for-bit parity**: we compared old output against new output on the 499 evaluation-set documents plus 300 random ones — 799/799 identical.

The interesting part is what **did not** pass the test. A first attempt "optimized" the `_force_split` binary search by seeding the range with a characters-per-token estimate. It failed on 7 of 799 documents. The reason is subtle: the token count of a prefix is not monotonic in prefix length — a BPE merge can straddle the cut point and *reduce* the count when adding a character. The original search, which is safe even when monotonicity fails, finds one cut; the seeded one finds another, equally valid but different: old chunk 2,792 characters, new chunk 2,798, both exactly 800 tokens. We reverted the seeding and kept only optimizations that do not touch any decision.

## Current status

The three foundations of the system already exist or are in progress:

1. **Corpus**: `dof_corpus_l3.sqlite`, 3.52 GiB, all rows compressed with their annual dictionary, verified against the original tree.
2. **Chunks**: `dof_chunks.sqlite`, 6,730,304 chunks as span recipes (91 B/chunk average, 0.75% literal fallbacks), reconstruction verified on 500/500 samples through the full query path (p50: 1 ms per chunk).
3. **Vectors**: the full embedding run is in progress — 6.73 million chunks at ~5.7 chunks/s, about 13.5 days of compute. Resumable, as it should be.

The number 6,730,304 settles an uncertainty from the original architecture: we estimated ~5.1 million chunks; the per-document real measurement (10.2 chunks/doc) confirms it, and all disk projections now use the measured figure.

Once the vector run finishes, the two final steps remain: the FTS5 index for BM25 over the full corpus (~2.8 GiB estimated) and the evaluation that matters — the 3,023 queries in the evaluation set against the **full** corpus, not the 499-document subset. MRR will drop compared to the PoC numbers, and that is signal, not regression: finding a document among 657,867 is simply harder than finding it among 499.
