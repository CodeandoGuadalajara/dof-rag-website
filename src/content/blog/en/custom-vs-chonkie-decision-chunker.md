---
title: "Custom vs Chonkie: why we built our own chunker for the DOF"
description: "We evaluated 8 chunking strategies (5 from Chonkie, 2 pipelines, 1 custom) on 1,000 Official Journal of the Federation (DOF) documents. No off-the-shelf library option preserved both document structure and the token limit."
date: "2026-07-26"
heroImage: ""
category: "development"
tags: ["dof-rag", "chunking", "chonkie", "benchmark", "decision"]
author: "Joaquín Bravo Contreras"
---

## The starting point: using a standard library

When we started the RAG, the sensible choice was [Chonkie](https://github.com/chonkie-inc/chonkie), a specialized chunking library with 11 chunkers, a pipeline API, and 33x faster than LangChain. Why reinvent the wheel?

But the Official Journal of the Federation (DOF) has structures no generic chunker understands:

- **Compound documents** with multiple decrees separated by H2 headings
- **Giant tables** from Miscellaneous Tax Resolutions (40 MB)
- **Tender notices** that use bold text as visual metadata
- **Judicial edicts** with no headings or structure

We decided to build a benchmark comparing our custom chunker against Chonkie's options. This post walks through what we found with each option, the fixes we had to make, and why the custom chunker won in the end.

## The benchmark

Sample: **1,000 random files** from `./dof_md` (2020–2026), fixed seed 42.
Limit: **800 tokens** per chunk, counted with the real tokenizer from [`pplx-embed-context-v1-0.6b`](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b).
Metrics: number of chunks, median/max tokens, % of files with oversized chunks (> 880 tokens), speed.

## Option 1: Chonkie RecursiveChunker (markdown)

The default option. Applies a markdown delimiter hierarchy: paragraphs → lines → sentences → words.

```python
from chonkie import RecursiveChunker
chunker = RecursiveChunker(
    tokenizer=PPLXTokenizer(),
    chunk_size=800,
    rules=RecursiveRules.from_recipe("markdown"),
)
```

**Result:** 7,157 chunks, median 707 tokens, max 800, 0% oversized.

It is stable and fast (20s). But it does not understand that an H2 in the DOF is an independent document. It splits complete decrees into arbitrary pieces.

**Example of a broken chunk:**

```markdown
## DECRETO por el que se reforman los artículos 4o. y 5o. de la Ley...

Artículo Primero...

---

## DECRETO por el que se reforma el artículo 7o. de la Ley...
```

The RecursiveChunker may split right at `---`, separating the decree title from its body.

## Option 2: Chonkie RecursiveChunker with H2 as primary delimiter

We tried making it more comparable to the custom chunker by using H2 as the first level:

```python
rules = RecursiveRules(levels=[
    RecursiveLevel(delimiters=["\n## "]),
    RecursiveLevel(delimiters=["\n### "]),
    RecursiveLevel(delimiters=["\n\n"]),
    RecursiveLevel(delimiters=[". ", "! ", "? "]),
])
```

**Result:** 7,028 chunks, median 702 tokens, max **7,895**, **4.7% oversized**.

The problem: when an H2 section is a giant paragraph or table with no sub-delimiters, Chonkie does not split it. A single H2 of 7,895 tokens remains as one chunk, exceeding the model limit.

**Example of an oversized chunk:**

An H2 with a 5,000-token table and no H3 or double paragraph breaks inside. The RecursiveChunker cannot find a place to cut and leaves it whole.

## Option 3: Chonkie TableChunker

Designed for documents dominated by tables. Detects tables and repeats the header in each chunk.

```python
from chonkie import TableChunker
chunker = TableChunker(tokenizer=PPLXTokenizer(), chunk_size=800)
```

**Result:** 13,856 chunks, median **3,634 tokens**, max **102,786**, **26.8% oversized**.

It is the worst result. TableChunker **does not respect the token limit** on large tables. A 100K-token Miscellaneous Tax Resolution remains as a single giant chunk.

**Example of an oversized chunk:**

```markdown
| **No. parte** | **Descripción** | **Monto** |
|---------------|-----------------|-----------|
| 1 | Material de oficina | 294,000 |
| 2 | Formas impresas | 134,778 |
... (thousands more rows) ...
```

The chunk contains the entire 100K-token table. Unmanageable for retrieval.

## Option 4: Chonkie TokenChunker

Fixed token windows with built-in overlap.

```python
from chonkie import TokenChunker
chunker = TokenChunker(tokenizer=PPLXTokenizer(), chunk_size=800, chunk_overlap=50)
```

**Result:** 6,132 chunks, median **800**, max 800, 0% oversized. The fastest (10.3s).

Perfect for strict limits, but it **completely ignores document structure**. It cuts at 800 tokens even if that is in the middle of a table, paragraph, or sentence.

**Example of a broken chunk:**

```markdown
...artículo 5o. de la Ley Federal de

---
(chunk 2)
Protección al Consumidor...
```

The sentence is split in two. For retrieval, context is lost.

## Option 5: Chonkie SentenceChunker

Cuts by sentence, with built-in overlap.

```python
from chonkie import SentenceChunker
chunker = SentenceChunker(tokenizer=PPLXTokenizer(), chunk_size=800, chunk_overlap=50)
```

**Result:** 6,273 chunks, median 765, max **2,997**, **0.7% oversized**.

Better than TokenChunker because it respects sentences, but some very long "sentences" (or table rows treated as sentences) exceed the limit.

## Option 6: Pipeline TableChunker → RecursiveChunker

Chonkie lets you chain chunkers in a Pipeline. We tried TableChunker first (to separate tables) and then RecursiveChunker (to split each section):

```python
pipeline = (
    Pipeline()
    .chunk_with("table", chunk_size=1600, tokenizer=tokenizer)
    .chunk_with("recursive", chunk_size=800, tokenizer=tokenizer)
)
```

**Result:** **98,576 chunks**, median 737, max 800, 0% oversized.

The pipeline explodes the number of chunks. TableChunker divides at every table boundary (even small 3–4 row tables), and then RecursiveChunker splits each fragment again. Some `giant_table` files generated up to **6,566 chunks** each.

It is not usable.

## Option 7: Pipeline RecursiveChunker → TableChunker (reversed)

A user suggested trying the reverse: RecursiveChunker first, then TableChunker only on fragments containing tables.

```python
pipeline = (
    Pipeline()
    .chunk_with("recursive", chunk_size=800, tokenizer=tokenizer)
    .chunk_with("table", chunk_size=800, tokenizer=tokenizer)
)
```

**Result:** **6,070 chunks**, median **761**, max 800, 0% oversized. Second fastest (14.8s).

Much better! This is Chonkie's best result. But there is a problem: **RecursiveChunker does not respect table boundaries**. It splits tables in the middle, and then TableChunker only receives incomplete fragments.

**Example of a broken table:**

```markdown
(chunk 0, 787 tokens)
**INSTITUTO DE SEGURIDAD...**

| **No. de licitación** | ... |
+-----------------------+-----+

(chunk 1, 309 tokens)
| 00637031-027-99 | ... | 1/03/99 |
+-----------------------+-----+
```

The table is split in two. The column headers stay in chunk 0, the data in chunk 1. For retrieval, the table context is lost.

## Option 8: Custom chunker (ours)

The custom chunker first classifies the document and then applies a specific strategy:

| Pattern | Trigger | Strategy |
|---|---|---|
| `small` | < 6 KB | Single chunk |
| `h2_compound` | ≥2 H2 | Each H2 is a document; kept whole up to 880 tokens |
| `bold_headers` | ≥2 bold texts | Split by paragraphs |
| `plain_text` | No structure | Split by paragraphs |
| `giant_table` | >40% lines are tables | Split by rows, repeat column headers, preserve non-table text |

**Result:** 7,735 chunks, median **706**, max **879**, 0% oversized.

But getting here was not straightforward. We had to make several fixes.

### Fix 1: The `+` separator bug

The biggest bug we found. Tables generated by [`marker-pdf`](https://github.com/datalab-to/marker) use separators that start with `+`, not `|`:

```markdown
|:------------------:|:-------:|
| **No. partida**    | ...     |
+--------------------+------------------+
| 1                  | ...     |
+--------------------+------------------+
```

The first version of the `giant_table` splitter only recognized `|` as a table line. Each `+` separator was interpreted as normal text and **flushed the buffer** after every row.

**Result before fix:** 26,634 chunks, median **36 tokens** (one row per chunk).
**Result after fix:** 7,735 chunks, median **706 tokens**.

The fix was simple but critical:

```python
def _is_table_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if stripped.startswith("|"):
        return True
    if stripped.startswith("+") and not stripped.startswith("+ "):
        return True
    return False
```

### Fix 2: H2_MAX_TOKENS

Compound documents (H2) sometimes contain sections that are complete decrees or resolutions. Splitting them at 800 tokens destroys document-level coherence.

We first tried `H2_MAX_TOKENS = 1_500`: H2s were kept whole up to 1,500 tokens. This produced 1.5% of files with oversized chunks (between 880 and 1,500 tokens).

We decided to be stricter: `H2_MAX_TOKENS = 880` (tolerance threshold). Now 0% oversized, and only 2 H2s in the sample benefit from remaining whole between 800 and 880 tokens.

### Fix 3: Preserve non-table text in giant_table

The first version of `giant_table` discarded all non-table text (introductions, notes, signatures). Now it alternates between two buffers:

```python
for line in text.splitlines():
    if _is_table_line(line):
        _flush_text_buffer()
        table_buffer.append(line)
    elif line.strip():
        _flush_table_buffer()
        text_buffer.append(line)
    else:
        text_buffer.append(line)  # empty line does not flush table
```

Result: a 760 KB document with 88% table lines produces **41 table chunks + 27 text chunks**, instead of losing all context.

## Final comparison

| Chunker | Chunks | Median | Max | Oversized | Time | Structure? |
|---|---|---|---|---|---|---|
| **Custom** | 7,735 | 706 | 879 | **0%** | 26s | ✅ Yes |
| Chonkie Pipeline Rev | 6,070 | 761 | 800 | 0% | 15s | ⚠️ Broken tables |
| Chonkie Token | 6,132 | 800 | 800 | 0% | 10s | ❌ No |
| Chonkie Sentence | 6,273 | 765 | 2,997 | 0.7% | 18s | ⚠️ Sentences |
| Chonkie Recursive | 7,157 | 707 | 800 | 0% | 20s | ⚠️ Generic |
| Chonkie H2 | 7,028 | 702 | 7,895 | 4.7% | 26s | ⚠️ H2s oversized |
| Chonkie Table | 13,856 | 3,634 | 102,786 | 26.8% | 18s | ❌ Giant tables |
| Chonkie Pipeline | 98,576 | 737 | 800 | 0% | 27s | ❌ Too many chunks |

## Why the custom chunker won

1. **Respects DOF structure**: whole H2s, tables with repeated headers, bold text as metadata.
2. **0% oversized**: meets the token limit with no exceptions.
3. **Optimal median**: 706 tokens is a good balance between granularity and context.
4. **Late-chunking compatible**: chunks from the same document can be concatenated for contextual embeddings.

## Lessons learned

1. **Off-the-shelf libraries do not know your domain**. Chonkie is excellent for generic markdown, but the DOF has specific patterns (compound documents, giant tables, bold text as metadata) that require specialized logic.

2. **The real tokenizer matters**. Using the tokenizer from [`pplx-embed-context-v1`](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) instead of a heuristic completely changed the results. Character "tokens" are not the same as model tokens.

3. **Format bugs are subtle but critical**. The `+` vs `|` separator in tables seemed like a minor detail, but it caused a 3.4x difference in the number of chunks.

4. **Pipeline order matters**. Table→Recursive explodes chunks; Recursive→Table is much better but still breaks tables. The best strategy is to classify first and apply the right strategy per pattern.

## Code and benchmarks

- Custom chunker: [`rag_poc/chunker.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/chunker-dof-patterns/rag_poc/chunker.py) (PR [#55](https://github.com/CodeandoGuadalajara/dof-rag/pull/55))
- Comparative benchmark: [`scripts/compare_chunkers.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/chonkie-chunker-comparison/scripts/compare_chunkers.py) (PR [#56](https://github.com/CodeandoGuadalajara/dof-rag/pull/56))
- Full report: [`reports/chunker_comparison.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/chonkie-chunker-comparison/reports/chunker_comparison.md)
- Size sweep: [`scripts/sweep_chunk_size.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/chonkie-chunker-comparison/scripts/sweep_chunk_size.py)

## Next steps

- PR [#57](https://github.com/CodeandoGuadalajara/dof-rag/pull/57): Local ONNX embedding ([`pplx-embed-context-v1-0.6b`](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b)) with late chunking
- PR [#58](https://github.com/CodeandoGuadalajara/dof-rag/pull/58): SQLite + sqlite-vec + FTS5 database layer
- PR [#59](https://github.com/CodeandoGuadalajara/dof-rag/pull/59): Hybrid search (vector + FTS5 with RRF) and CLI
