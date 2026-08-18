---
title: "Pattern-based chunker: classifying 131,000 DOF documents before splitting them"
description: "We present the RAG chunker: a classifier that detects 5 structural patterns in DOF Markdown before applying the right split strategy."
date: "2026-05-23"
heroImage: ""
category: "development"
tags: ["dof-rag", "chunking", "rag", "pplx-embed", "sqlite-vec"]
author: "Joaquín Bravo Contreras"
---

## The problem: a generic chunker doesn’t understand the DOF

Generic chunkers (like `MarkdownSplitter` or `RecursiveCharacterTextSplitter`) apply the same heuristic to every document. But the Official Journal of the Federation (DOF) has very different structures:

- **Compound documents** with multiple decrees/agreements in a single file, separated by H2
- **Tender notices** that use bold text as visual metadata, not as sections
- **Miscellaneous Tax Resolutions** of 40 MB that are almost pure Markdown tables
- **Judicial edicts** of 15 KB with no headings or bold text
- **Small notices** of 2 KB that don’t need chunking

Applying the same splitter to everything produces chunks of very uneven quality. Some documents are broken into pieces that lose context; others generate giant chunks that exceed the model’s token limit.

## The solution: classify first, split later

The chunker detects the document’s structural pattern **before** splitting, and applies a specific strategy for each case:

| Pattern | Trigger | Strategy |
|---|---|---|
| `small` | < 10 KB | Single chunk — the full document fits in context |
| `h2_compound` | ≥2 H2 headings | Each H2 is an independent document; if it exceeds the limit, split by H3 |
| `bold_headers` | ≥2 bold lines | Bold text is header metadata, not boundaries; split by paragraphs |
| `plain_text` | No headings or bold text | Split by double paragraphs with overlap |
| `giant_table` | >40% of lines are Markdown tables | Each table is a chunk; column headers are repeated; non-table text is preserved |

## Results: 1,000 documents from 2020

We ran the chunker on a random sample of 1,000 files from the `2020/` directory:

| Pattern | Documents | % |
|---|---|---|
| small | 719 | 71.9% |
| giant_table | 156 | 15.6% |
| bold_headers | 68 | 6.8% |
| h2_compound | 46 | 4.6% |
| plain_text | 11 | 1.1% |

**The vast majority of documents (72%) are small** — a single chunk is enough. Large documents (15.6%) are dominated by tables, confirming that table chunking is critical for the corpus.

### Chunks per document

| Pattern | Average | Median | Maximum |
|---|---|---|---|
| small | 1.0 | 1 | 1 |
| h2_compound | 98.9 | 82.5 | 454 |
| bold_headers | 23.0 | 9.0 | 251 |
| giant_table | 1,229.8 | 114.0 | 48,977 |
| plain_text | 76.2 | 8.0 | 677 |

`giant_table` documents generate many chunks because tables are split row by row (with column headers repeated). The extreme case of 48,977 chunks corresponds to a ~12 MB Miscellaneous Tax Resolution.

### Tokens per chunk

| Pattern | Average | Median | Maximum |
|---|---|---|---|
| small | 854 | 708 | 2,989 |
| h2_compound | 685 | 810 | 1,476 |
| bold_headers | 726 | 748 | 1,590 |
| plain_text | 781 | 794 | 1,424 |
| giant_table | 59 | 18 | 5,569 |

The configured limit is `MAX_TOKENS = 800`. The `h2_compound`, `bold_headers`, and `plain_text` patterns respect it. `small` documents occasionally exceed it (9–10 KB documents that the classifier leaves as `small`). The 5,569-token outlier in `giant_table` comes from extremely long table rows that don’t fit within the limit; this will be mitigated once we replace the heuristic counter with the real tokenizer.

## How the chunker works

### The classifier

```python
def classify(text: str, size_bytes: int) -> DocPattern:
    if size_bytes < 10_000:
        return DocPattern.SMALL

    # ¿Más del 40% de las líneas son tablas?
    lines = text.splitlines()
    non_empty = [ln for ln in lines if ln.strip()]
    table_lines = sum(1 for ln in non_empty if ln.strip().startswith("|"))
    if non_empty and table_lines / len(non_empty) > 0.40:
        return DocPattern.GIANT_TABLE

    if size_bytes > 1_000_000:
        return DocPattern.GIANT_TABLE

    if len(H2_RE.findall(text)) >= 2:
        return DocPattern.H2_COMPOUND
    if len(BOLD_RE.findall(text)) >= 2:
        return DocPattern.BOLD_HEADERS
    return DocPattern.PLAIN_TEXT
```

Classification is fast: it only counts headings, bold lines, and table lines. It does not tokenize the entire text.

### Contextual late chunking

The embedding model (`pplx-embed-context-v1`) is **contextual**: chunks from the same document must be seen together so the model can infer relationships between them. The chunker doesn’t just produce individual chunks; the indexing pipeline concatenates them with `SEP` tokens:

```
[chunk1] [SEP] [chunk2] [SEP] [chunk3]
```

After ONNX inference, **late chunking** is performed: the `SEP` tokens are located in the output and each segment is mean-pooled to obtain each chunk’s embedding. This is more accurate than embedding each chunk independently.

### Preserving non-table text

The first version of the `giant_table` chunker discarded all non-table text (introductions, notes, footnotes). The current version alternates between two buffers:

```python
for line in text.splitlines():
    if line.startswith("|"):
        _flush_text_buffer()   # guarda párrafos acumulados
        table_buffer.append(line)
    else:
        _flush_table_buffer()  # guarda tabla acumulada
        text_buffer.append(line)
```

Result: a 760 KB document with 88% table lines produces **41 table chunks + 27 text chunks**, instead of losing all textual context.

## Fixes applied after Copilot review

| # | Problem | Fix |
|---|---|---|
| 1 | `GIANT_TABLE` discarded non-table text | Now `table_buffer` and `text_buffer` alternate; both are packed into chunks |
| 2 | `_split_by_heading` crashed on a heading with no final newline | `text.index("\n", pos)` → `text.find("\n", pos)` with a fallback to `len(text)` |
| 3 | H2 with no H3 sub-headings injected an empty `### ` | Detect `_split_by_heading` returning a single tuple with an empty heading; split directly without H3 |
| 4 | Heuristic `_count_tokens` underestimated tables | Now lazily loads the real tokenizer (`pplx-embed-context-v1-0.6b`) via `transformers` |

## The token counter

The most accurate counter is the model’s own:

```python
_tokenizer = None

def _count_tokens(text: str) -> int:
    global _tokenizer
    if _tokenizer is None:
        from transformers import AutoTokenizer
        _tokenizer = AutoTokenizer.from_pretrained(
            "perplexity-ai/pplx-embed-context-v1-0.6b",
            trust_remote_code=True,
        )
    return len(_tokenizer.encode(text, add_special_tokens=False))
```

If `transformers` is not available, it falls back to `len(text) // 3` (a conservative heuristic). The first call downloads the tokenizer (~2 MB); subsequent calls use the cached instance.

## Known limitations

1. **Model token limit**: The `pplx-embed-context-v1` tokenizer has a 32K token limit. If a document produces chunks whose combined length exceeds that limit, the indexing pipeline divides them into sub-groups, each carrying front matter (the document’s H1 + H2) to preserve context.

2. **Brute force in sqlite-vec**: Current vector search is exact KNN (L2 distance). With >100K chunks this will become slow. The alternative is to partition by metadata (year, agency) or migrate to approximate indexes.

3. **Images**: `IMAGE_DESCRIPTION` HTML comments are inlined as text, but images without captions (small math formulas, logos) don’t generate a description. The VLM pipeline (`enrich_markdown_images.py`) catches most of them.

## Code

The chunker is in `rag_poc/chunker.py` (PR #55). Usage:

```python
from pathlib import Path
from rag_poc.chunker import split_file

chunks = split_file(Path("./dof_md/2020/01/15012020/MAT/001_DOF_20200115_MAT_5583902.md"))
for ch in chunks:
    print(ch.heading_path, ch.chunk_index, ch.pattern.value)
```

## Next steps

- PR #56: Local ONNX embedding (`pplx-embed-context-v1-0.6b`) with late chunking
- PR #57: SQLite + sqlite-vec + FTS5 database layer
- PR #58: Hybrid search (vector + FTS5 with RRF) and CLI
