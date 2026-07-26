---
title: 'Giving Context to Embeddings: Structured Headers'
date: 2025-05-06T06:00:00.000Z
author: DOF-RAG Team
description: >-
  How we solved the problem of lack of context in text chunks to improve the accuracy of our RAG system.
image: '/images/posts/2025/05/ChatGPT Image 6 may 2025, 01_56_28 p.m..png'
tags:
  - NLP
  - chunks
  - embeddings
  - RAG
  - DOF-RAG
featured: true
---

# The Lost Context Problem: When Chunks Become Orphans

Imagine we're reading a novel, but someone has torn out all the pages and shuffled them like a deck of cards. On each page you read phrases like: **"He decided that enough was enough"** or **"The situation worsened considerably"**. Who is "he"? What situation worsened? Without proper context, these phrases are practically useless.

Well, this is exactly the problem we faced with our RAG system for the Official Journal of the Federation. When we divided documents into small fragments (chunks) for processing, they lost their original context, leading to two critical problems:

1. **Poor retrieval**: Chunks that should be relevant to a query were not retrieved because they contained pronouns instead of explicit references.
2. **Hallucinations**: The model received decontextualized fragments and generated incorrect or made-up responses.

## The Solution: Contextual Chunk Headers

The idea is simple: add a header to each chunk that provides the necessary context. Like putting a small label on each loose page of our book that says, for example: "Chapter 5: Juan's Betrayal."

We implemented two different approaches to solve this problem:

### Approach 1: The Simplified Method

The first attempt was to create headers with a flat format:

```
Document: 01052025-DOF | Section: Title 1 > Subtitle A > Section 3 | Page: 5
```

This method concatenated all headers found in the chunk, separated by a ">" symbol, and added the page number. It was like putting a breadcrumb that showed the path from the beginning of the document.

**Simplified code:**

```python
def build_chunk_header(doc_title, heading_list):
    if not heading_list:
        return f"Document: {doc_title}"
    hierarchy_str = " > ".join(heading_list)
    return f"Document: {doc_title} | Section: {hierarchy_str}"
```

### Approach 2: Structured Headers to the Rescue

But we soon realized that this flat approach did not adequately preserve the hierarchy of headers. So we implemented a more sophisticated solution: keeping track of "open headings" as we go through the document, respecting their hierarchical level (H1, H2, H3, etc.).

**Simplified code:**

```python
def build_header(doc_title, page, open_headings, chunk_number):
    header_lines = [f"# Document: {doc_title} | page: {page}"]
    
    for (lvl, txt) in open_headings:
        hashes = "#" * lvl
        header_lines.append(f"{hashes} {txt}")
        
    return "\n".join(header_lines)
```

The result is a header that looks more like the actual document structure:

```
# Document: 01052025-DOF | page: 5
## Title 1
### Subtitle A
#### Section 3
```

## The Difference Between the Two Approaches

Although both methods seek to solve the same problem, their differences are fundamental:

| Feature                | Approach 1 (Flat)                            | Approach 2 (Structured)                                          |
| ---------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| **Structure**          | Linear, concatenating titles with separators | Hierarchical, preserving levels with Markdown syntax              |
| **Context memory**     | Inherits only the last heading               | Maintains the complete structure of "open headings"              |
| **Representation**     | `Title > Subtitle > Section`                 | Multi-line format with levels `#`, `##`, `###`                   |
| **Level handling**     | Ignores heading hierarchy                    | Explicitly respects and represents relationship between H1, H2, H3, etc. |
| **Special treatment**  | No differentiation between fragments         | First fragment receives special treatment                        |

This difference is crucial because:

1. **For the embedding model**: The hierarchical structure provides richer semantic signals that help the model better understand relationships between concepts.
2. **For retrieval**: Search terms are more likely to match the explicit structure of headers than a flat string.
3. **For the LLM**: When generating responses, the model can understand exactly at what level of the hierarchy each fragment is located, reducing ambiguities and allowing for more precise answers.

The structured approach also implements sophisticated logic that detects when a higher-level heading (such as an H1) should "reset" the context, while lower-level headings accumulate appropriately, maintaining document coherence even when fragments are separated by multiple pages.

## Lessons Learned

This experience taught us something important: context is everything. We can have the best embedding models and the most advanced LLMs, but if we give them fragmented and decontextualized information, we'll get mediocre results.
It's like asking someone to solve a puzzle without showing them the complete picture. They might try, but they'll probably place some pieces in the wrong places.

## What's Next?

It's important to highlight that our current solution fundamentally depends on two factors:

1. **Quality of title hierarchy**: The effectiveness of the method depends on documents having well-defined and semantically relevant titles and subtitles, not just generic labels like "Introduction" or "Chapter 1" that provide little real context.
2. **Accuracy of the markdown extractor**: The extractor must correctly interpret the heading hierarchy, avoiding confusion between levels (for example, H1 with H2), a problem we've detected in the current implementation.

In the ecosystem, innovative methods continue to emerge to solve the context loss problem. Here are some promising approaches that could complement our current solution:

### Contextual Retrieval (Anthropic)

This technique introduces two sub-techniques that enrich the retrieval stage:

* **Contextual Embeddings**: A contextual text (50-100 tokens) is automatically generated for each chunk using an LLM like Claude, briefly describing its position and content within the original document.
* **Contextual BM25**: In addition to semantic embeddings, a BM25 index is created on these same contextualized chunks to capture exact lexical matches.

By combining semantic embeddings with lexical BM25, Anthropic has demonstrated a 49% reduction in retrieval failure rate. And if a reranking step is added, this improvement reaches an impressive 67%.

### Contextual Document Embeddings (CDE)

CDE implements a sophisticated two-stage process:

1. **First phase**: A representative subset of the complete corpus (called "minicorpus") is selected and a collective embedding called `dataset embeddings` is calculated.
2. **Second phase**: When generating embeddings of individual documents and queries, the model conditions its representations on these `dataset_embeddings`, integrating context tokens that reflect the complete distribution of the corpus.

This approach significantly improves the contextual coherence of searches, even when the exact corpus on which queries will be made is not known in advance.

### Late Chunking (Jina)

This method revolutionizes the traditional chunking process by leveraging long-context embedding models (up to 8,192 tokens):

1. The transformer is first applied to the full text or maximum possible context, obtaining token-by-token embeddings.
2. Subsequently, pooling (averaging) is performed **per fragment**, generating chunks whose vector representation already includes semantic information from the entire document.

This approach preserves long-distance relationships and significantly improves retrieval metrics such as nDCG@10 compared to the traditional method of chunking prior to transformation.

These techniques represent interesting directions for research and could offer new ways to improve RAG systems. Perhaps one of them, or a combination, could be a natural evolution of our work.

*This post is part of our DOF-RAG project for intelligent processing and querying of documents from the Official Journal of the Federation. For more information on the complete architecture, system components, and project progress, check our [GitHub repository](https://github.com/CodeandoGuadalajara/dof-rag).* 