---
title: "The First Real-Scale Evaluation: BM25 Against 657,867 Documents, from 0.170 to 0.366 After Fixing the Set"
description: "While the embedding run advances over 6.7 million chunks, we built the full-corpus FTS5 index (2.7 GiB) and ran the first real-scale BM25 evaluation. The v2 query set produced an MRR of 0.170; after fixing fake titles and ambiguous queries, v3 reached 0.366 and the partial hybrid smoke test 0.402. Along the way: a COUNT(*) that lies, 32 documents almost invisible to the index, and a token-pruning step that turned 21 hours of queries into 34 minutes without changing the metrics."
date: "2026-08-06"
heroImage: ""
category: "development"
tags: ["dof-rag", "evaluation", "bm25", "fts5", "sqlite", "vector-search", "embedding"]
author: "Joaquín Bravo Contreras"
---

## What we’re talking about

The [previous post](/en/blog/2026/08/corpus-completo-bugs-de-escala/) closed with the embedding run in progress: 6.73 million chunks at ~5.7 chunks/s, about 13.5 days of continuous compute. Before describing what we did in the meantime, it’s worth remembering what all that compute is for.

The system we’re building answers natural-language queries against the 657,867 documents of the Official Journal of the Federation (DOF): a question goes in (“how do I participate in a government tender?”) and a list of candidate documents comes out. It does this with **hybrid search**: two retrieval mechanisms that work separately and whose results are fused at the end.

- **BM25**, the classic word-based search. A full-text index records which documents contain each term; when a query arrives, it looks up the words and ranks documents by statistical relevance (term frequency, rarity in the corpus). It is exact but literal: if the right document doesn’t use the query words, it doesn’t appear.
- **Vector search**. Each text chunk is turned into a 1,024-number vector (its *embedding*), and the query into another; chunks whose vectors are “close” to the query vector become candidates even if they don’t share a single word. It captures synonymy and paraphrase, but blurs exact details (article numbers, dates, acronyms).

The project hypothesis — already validated on a 499-document subset, where fusion won clearly — is that combining both yields better results than either alone. The ongoing embedding run is precisely what the vector component needs: converting the 6.73 million chunks of the full corpus into vectors.

Everything built so far (compressed corpus, chunk index, embeddings in progress) is infrastructure. The pending question is quality: **how often does the system find the correct document when 657,867 documents act as distractors?** To measure it we have an evaluation set: 3,023 queries whose correct document we know in advance — the literal title of each document, its first words, and 2,025 generated queries (factual, thematic, paraphrase). Because we know which document should win each query, we can measure the position at which it appears. The main metric is **MRR** (Mean Reciprocal Rank): the average of 1/position of the correct document. If it appears first, it contributes 1; second, 0.5; if it isn’t in the top-50, it contributes 0.

Until now that evaluation had only been run against the subset: queries searched among the same 499 documents in the set. Those numbers were an optimistic bound — finding one document among 499 is much easier than among 657,867. This post tells the story of the first real-scale measurement, that of the BM25 component, and everything that had to be built and fixed to obtain it. The index code, evaluation harnesses, and reproducible results are published in [dof-rag PR #63](https://github.com/CodeandoGuadalajara/dof-rag/pull/63), continuing [PR #62](https://github.com/CodeandoGuadalajara/dof-rag/pull/62) which built the full corpus.

Results first; each row is developed in a section:

| Component | Result |
|---|---:|
| Full-corpus FTS5 (BM25) index | **~2.7 GiB**, built in ~8 minutes |
| Evaluation queries | v2: 3,023; v3: 3,013 (float + binary sign-packed) |
| **BM25 over 657,867 documents: MRR** | v2: 0.170 → **v3: 0.366** |
| Cost per BM25 query | 17–45 s → **0.7 s** after pruning tokens |
| Hybrid smoke test v3 (1.39 M vectors) | **W0.5: 0.402** > BM25: 0.362 > vectors: 0.252 |

The first run gave 0.170. Part of the drop from 0.589 was indeed the effect of searching among 657,867 documents instead of 499, but it wasn’t the whole story: when reviewing the results we found fake titles and queries whose expected document was not unique. v3 fixes those defects and raises BM25 to 0.366. The breakdown, the set fixes, and what this means for hybrid fusion are below.

## The FTS5 index: two traps and a tokenizer mismatch

To evaluate the BM25 component of hybrid search we need a full-text index over the 657,867 documents. We use SQLite FTS5 in **external content** mode: the virtual table stores only the index (term → document list), and the text lives in the already zstd-compressed `documents` table. Thus the index does not duplicate the 31.5 GiB of text; in total it added ~2.7 GiB to the database.

Construction is trivial on a sample (`INSERT INTO documents_fts(documents_fts) VALUES('rebuild')` and done), but at real scale two traps appeared.

### Trap 1: `COUNT(*)` on an external-content FTS5 table lies

Our build script was resumable by design: before indexing, it asked how many rows the index already had, so it could continue from there. The first run reported:

```
documents: 657,867  already indexed: 657,867
```

Index “complete” without having indexed anything. What happens is that on an external-content FTS5 table, a `SELECT COUNT(*)` (or a `MAX(rowid)`) **does not query the index — it queries the content table**. SQLite answers the count by reading `documents`, which of course has 657,867 rows. The only way to know what is really in the index is a `MATCH` query (which does use the index) or the shadow table `documents_fts_docsize` (one row per indexed document). The actual index at that moment had 32 documents.

This goes beyond FTS5. SQLite virtual tables implement their own rules for each query type, and an operation as harmless as counting rows may be answering about something else. Verify the invariant with a query that exercises the index, not one that merely surrounds it.

### Trap 2: 32 documents that a plain `rebuild` indexes as empty

As we explained in the [storage PoC](/en/blog/2026/08/poc-almacenamiento-corpus/), documents larger than 32 MiB are stored in ordered segments to avoid decompressing a giant row entirely into memory. In `documents`, those documents keep their metadata but have `markdown = ''`; the real text lives in `document_segments`.

The problem is that the standard FTS5 `rebuild` only reads `documents.markdown`: it sees an empty string and creates a record with no indexable terms. That’s why the builder must reassemble the segments and insert them explicitly into the index. In total there are 32 documents; among them is the 671 MiB manual that already caused chunking problems, so they are not marginal documents.

### The mismatch: a different tokenizer from the reference evaluation

The previous evaluation (499-document subset) built its FTS5 with `unicode61 remove_diacritics 1`: when indexing and searching, accents are removed and everything is normalized to lowercase. Our first index used the default tokenizer, which keeps accents. Does it matter? Yes: with folding, `declaracion` and `declaración` are the same term (75,414 documents in both cases); without folding they are two distinct terms, and any MRR comparison against the reference would mix two effects: corpus size and tokenizer. Since the goal was to measure the corpus effect, we rebuilt the index with the same tokenizer as the reference (~8 minutes, not painful) and left that DDL as the canonical one in `corpus_store/acceptance.py`.

## Queries embedded with the same model as the corpus

The evaluation set has 3,023 queries over 499 documents: the literal title of each document, the first ~20 words, and 2,025 generated queries (factual, thematic, paraphrase, and specific-article). For vector search we need their embeddings, and here there is an easy restriction to violate: because **query and document must live in the same embedding space** for Hamming-distance search to work. The corpus vectors come from the local jina-v5-small GGUF running on llama.cpp with the `Query: ` / `Document: ` prefix; the queries must come from the same server with the same prefix. Reusing cached embeddings from the Jina API (left over from earlier experiments) would have introduced a different space — out of curiosity we measured cosine between the two: 0.936 on average, different enough to ruin a bit-by-bit comparison.

The 3,023 queries were embedded with the production server (shared with the main run; it cost 582 seconds of shared GPU, imperceptible at 5.66 chunks/s) and cached in float32 and binary sign-packed form.

## BM25 against 657,867 documents

With the index and queries ready, we ran the first half of the evaluation: the 3,023 queries against the full-corpus FTS5, depth 50. The table compares against the previous reference, the 499-document subset:

| Metric | Subset (499 docs) | Full corpus (657,867 docs) |
|---|---:|---:|
| MRR | 0.589 | **0.170** |
| R@1 | 0.530 | 0.119 |
| R@5 | 0.668 | 0.224 |
| R@10 | 0.713 | 0.269 |

By query type (full corpus):

| Type | MRR | n |
|---|---:|---:|
| factual | 0.282 | 1,009 |
| first_words | 0.227 | 499 |
| paraphrase | 0.118 | 428 |
| specific article | 0.118 | 110 |
| literal title | 0.082 | 499 |
| thematic | 0.025 | 478 |

Three observations:

1. **The ~3.5× drop is the expected distractor effect.** The full corpus has ~1,319× more documents than the subset; the MRR dropping is the signal that the evaluation now measures real difficulty, not a system regression.
2. **Thematic queries measure something else.** Their MRR of 0.025 doesn’t mean BM25 is bad for topics; when we reviewed them we found they are user questions (“how can I tell how much I owe if my credit is in dollars?”) that **do not identify a unique document**: their expected document is *one* valid answer among hundreds or thousands. The extreme example: the exchange rate is published every business day for 27 years, and the rarest tokens in the expected document’s title appear in **7,592 equivalent documents** — without the date in the query, no search engine can distinguish the expected one from the other 7,591. The problem is not the index or the model: it is that the metric (position of ONE gold document) does not match the task (find ANY document that answers). The fix lies in the evaluation set, not the index: regenerate these queries with identifying details (dates, amounts, entity names, agreement numbers), or treat them as answer evaluation with a judge, not as retrieval evaluation.
3. **The literal title is no longer trivial** (0.082), and here two causes are mixed. The first is genuine to the corpus: with 27 years of DOF editions, hundreds of documents share almost identical titles (“ACUERDO por el que se...”, same procedure, different date). The second is a defect in our own evaluation set, discovered when reviewing the results: **271 of the 499 title queries (54%) are not real titles but filenames** (`093_AVISO_20180227_MAT_5514595`), used when the document has no extractable heading. That string does not appear in the document text, so the query is essentially impossible for any text search engine — almost guaranteed zeros that depress the average (and they also depressed the subset figures, so the comparison remains fair). It remains pending to regenerate titles from the first Markdown heading or exclude these queries from the set.

## Why the queries were 25× slower than necessary

The evaluation almost didn’t happen as planned. The MATCH construction used by the reference harness is the naive one: every word in the query becomes a quoted term, joined with `OR`. Over 499 documents that is instant; over 657,867 we measured **17 to 45 seconds per query** — about 21 hours for the full set.

The cause lies in how FTS5 computes ranking. To score a query with BM25 it must traverse the *doclist* (the list of documents containing each term) for every query term. Spanish function words have monstrous doclists: `de` appears in 657,642 of 657,867 documents (99.97%), `la` in 649,547. A 20-word query with 8 stop words forces FTS5 to read and score several million entries per query.

However, those terms **cost a huge amount and contribute almost nothing to ranking**. BM25 weights each term by its IDF (inverse document frequency), which tends toward zero when the term appears in the majority of documents. The raw IDF formula even becomes non-positive when a term appears in more than half the corpus, and FTS5 clamps it to a tiny positive value. In practice, `de` barely moves the ranking, yet it still forces traversal of a gigantic doclist.

With that observation in hand, the fix was to prune the queries. We built an `fts5vocab` table with the document frequency of the index’s 2.35 million terms, and removed from each query any tokens with frequency greater than N/2. Before adopting it we verified equivalence: on test queries, the top-50 document set was identical and the position of the correct document did not change; only the order of some tail results permuted. With that, cost dropped to **0.7 seconds per query, 34 minutes for the 3,023**, without altering the metrics or the retrieved candidates.

## Smoke test of the full hybrid pipeline

The vector component of the evaluation needs the 6.73 million vectors, which don’t yet exist. But the search index (sqlite-vec, `bit[1024]`) is resumable by `rowid`, so we built it over the vectors already written (768 thousand at that point, 2 seconds to build) and ran the full hybrid harness as a mechanics check, restricting metrics to the 335 queries whose expected document was already embedded:

| System | MRR | R@1 | R@10 |
|---|---:|---:|---:|
| W0.5 (BM25 + vectors, α=0.5) | **0.269** | 0.203 | 0.394 |
| RRF | 0.262 | 0.188 | 0.412 |
| vectors only (collapsed to document) | 0.200 | 0.134 | 0.328 |
| BM25 only | 0.189 | 0.125 | 0.299 |

Two things we wanted to see, we saw. First, the mechanics work end-to-end: binary query → Hamming k=50 over the index → chunk-to-document collapse (each document inherits its best chunk’s distance) → weighted fusion with min-max normalization against BM25 lists. Second, **hybrid fusion already beats each component separately**, reproducing the pattern from the 499-document subset, where the hybrid was the clear winner. It’s worth repeating the caveat: in this mode vector search operates only over already-embedded documents while BM25 searches the whole corpus, so these are mechanics-validation numbers, not final quality numbers.

The breakdown by query type confirms the expected division of labor between the two components:

| Type | BM25 only | vectors only | W0.5 |
|---|---:|---:|---:|
| factual | 0.317 | 0.208 | 0.359 |
| first_words | 0.287 | 0.315 | 0.441 |
| paraphrase | 0.135 | 0.340 | 0.303 |
| specific article | 0.020 | 0.100 | 0.200 |
| thematic | 0.058 | 0.106 | 0.116 |
| literal title | 0.023 | 0.043 | 0.044 |

BM25 wins where the query uses the document’s words (factual), vectors win where the query paraphrases or asks about topics (paraphrase, thematic, articles), and fusion lands above both in almost everything. Thematic queries remain low in absolute terms across all systems (0.116 even with fusion), but we already know why: the gold document is one valid answer among hundreds or thousands of equivalents, and the metric only gives credit for that one. Until the evaluation set distinguishes “find THIS document” from “find ANY document that answers,” that row measures task ambiguity, not retrieval quality.

Two quick experiments on these numbers. First, we tested whether the Hamming scan depth k=50 was cutting off correct documents: at k=200 vector MRR went from 0.200 to 0.201 — nothing. The documents that are lost are not lost because of the depth cutoff; they are lost because their chunks don’t rank. Second, isolating the filename-title defect: excluding the 40 title-slug queries from the eligible group, W0.5 rose from 0.265 to **0.301** (vectors 0.201 → 0.228, BM25 0.189 → 0.214). So part of the drop relative to the subset was evaluation-set noise; the rest is genuine corpus difficulty.

## Update: the v3 evaluation set and its results

One week of work after the narrative above, the two defects in the evaluation set were fixed and the numbers changed substantially. Building v3 had two parts. The first was free: the 271 filename titles were replaced with real titles extracted programmatically — the DOF almost never uses Markdown headings for titles, but the vast majority of documents open with the institution and the title in bold blocks (`**SECRETARIA DE...** **ACUERDO...**`), and judicial edicts with a plain-text block; three simple rules (Markdown headings, bold blocks, first lines) covered 271/271. The second part used an LLM: the thematic and paraphrase queries were regenerated with instructions to include identifying details (dates, amounts, agencies, agreement or tender numbers), and each generated query passed a programmatic anchor validation — it must contain at least one token that appears in the document and exists in less than 0.1% of the corpus (verifiable against the `fts5vocab` table), or a number of four or more digits. The model was `kimi-for-coding` with thinking mode disabled (thinking tokens are billed as output; turning them off saved ~0.5M tokens), and the total cost for the 896 regenerated queries was ~0.95M input tokens and ~30K output tokens, without a single error.

Along the way a third bug appeared, this time in the evaluation harness: literal-title queries were not built from the dataset’s `title` field but from the headings detected by the chunker, so the title correction had no effect until the harness learned to prefer the dataset title.

BM25 results over the full corpus, v2 vs. v3:

| Type | v2 MRR | v3 MRR |
|---|---:|---:|
| **total** | 0.170 | **0.366** |
| thematic | 0.025 | **0.641** |
| paraphrase | 0.118 | **0.611** |
| literal title | 0.082 | 0.260 |
| factual | 0.282 | 0.282 |
| first_words | 0.227 | 0.227 |
| specific article | 0.118 | 0.118 |

The system was never as bad as v2 suggested: almost half of the drop attributed to distractors was actually evaluation-set noise. And difficulty is redistributed interestingly — anchored queries play to BM25’s strengths, because rare tokens (dates, amounts, tender codes like `LO-013J2W002-E21-2023`) are exactly what IDF rewards. Thematic went from worst type to best. The genuine remaining difficulty is in queries whose gold is a *chunk* inside a document (first_words, specific article): there the problem is granularity, not vocabulary.

The hybrid smoke test was also re-run with v3 (665 eligible queries, 1.39 million vectors already computed):

| System | MRR | R@1 | R@10 |
|---|---:|---:|---:|
| W0.5 (BM25 + vectors, α=0.5) | **0.402** | 0.305 | 0.589 |
| W0.75 (more weight on BM25) | 0.399 | 0.310 | 0.565 |
| RRF | 0.382 | 0.277 | 0.579 |
| BM25 only | 0.362 | 0.263 | 0.535 |
| W0.25 (more weight on vectors) | 0.309 | 0.239 | 0.445 |
| vectors only | 0.252 | 0.189 | 0.374 |

And by type, the detail that changes the conversation:

| Type | BM25 only | vectors only | W0.5 |
|---|---:|---:|---:|
| paraphrase | **0.637** | 0.298 | 0.614 |
| thematic | 0.577 | 0.407 | **0.609** |
| first_words | 0.275 | 0.283 | **0.388** |
| factual | 0.274 | 0.173 | **0.306** |
| literal title | 0.232 | 0.198 | **0.259** |
| specific article | 0.104 | 0.208 | **0.251** |

Three readings. First, with anchored queries the component ranking flips: BM25 (0.362) clearly beats binary vectors (0.252), the opposite of what we saw with v2 queries. Second, vector strength is now concentrated where the gold is a specific fragment of the document: on specific article it doubles BM25 (0.208 vs. 0.104). Third, W0.5 wins overall not by winning everywhere — on paraphrase it loses to BM25 alone (0.614 vs. 0.637) — but by not collapsing on any type. That reinforces the per-query adaptive-weight argument raised in the [benchmark post](/en/blog/2026/08/benchmark-hibrido-m3-gguf/): a fixed α leaves points on the table in both directions.

The final evaluation against all 6.73 million vectors remains pending; we will report it on both cuts (v2 and v3) to preserve historical comparability.

## Status and what’s left

1. **Corpus, chunks, FTS5**: built and verified.
2. **Embeddings**: ~1.4 million of 6.73 million vectors, steady pace of 5.66 chunks/s, ETA around August 17. Resumable, as it should be.
3. **Evaluation**: BM25 measured on v2 (0.170) and v3 (0.366); hybrid smoke test v3 (W0.5 0.402) with the hybrid pattern intact. When the vectors finish, the final full evaluation is two commands.
4. **Non-technical pending**: license review of sqlite-vector (modified Elastic 2.0) and sqlite-zstd (LGPL-3.0) before any production deployment. sqlite-vec, the dependency we are actually using for vectors, is MIT.
5. ~~**Evaluation set**~~: v3 built and validated (above). The final evaluation will report both cuts.
6. **Search tools for the agent** (from the plan in the [benchmark post](/en/blog/2026/08/benchmark-hibrido-m3-gguf/)): in addition to BM25 and vectors, the corpus already supports metadata tools that would turn impossible queries into trivial ones — title search (the v3 extractor already demonstrates the bold-block rule), direct lookup by path/slug, and filters by date, section, and issuer (the columns already exist). With an agent that classifies the question and chooses tool and fusion weight per case, the query types that look “bad” today change nature.

The number to watch when the final evaluation arrives: not the absolute MRR (which will be low compared with the subset, by design), but **the gap between the hybrid and each component separately**. If in the full corpus fusion still wins by the same relative margin as in the subset, the architecture holds at real scale. We’ll tell that story in the next post.
