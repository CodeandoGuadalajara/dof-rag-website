---
title: 'From finding documents to finding evidence: five tools for querying the DOF'
description: 'How we separated document search from passage retrieval and built five deterministic, traceable, and evaluable tools on top of the DOF.'
date: '2026-08-13'
heroImage: ''
category: 'development'
tags:
  ['dof-rag', 'retrieval', 'bm25', 'tools', 'evaluation', 'evidence']
author: 'Joaquín Bravo Contreras'
---

## The problem was not just searching

Evaluation v4 showed us an important difference: finding the right publication does not mean finding the passage that supports the answer. A query can retrieve the appropriate decree and yet deliver the wrong article, an incomplete transitory provision, or a table that only contains half of the data.

In the Official Journal of the Federation (DOF), there are two distinct retrieval problems:

1. discovering which publications are candidates among hundreds of thousands;
2. locating, within those publications, the fragments that support the answer.

[`dof-rag` PR #67](https://github.com/CodeandoGuadalajara/dof-rag/pull/67) builds a first solution for both problems. Before asking a model to draft an answer, we give it small, deterministic, and verifiable operations to find and read evidence.

This separation also makes it possible to diagnose failures. If an answer is incorrect, we can ask whether the searcher failed to find the publication, whether the passage fell outside the top results, or whether the model misinterpreted evidence it did receive.

## Five operations with clear contracts

A tool is a function with defined inputs and outputs. It receives validated arguments and returns reproducible results as long as the indexes do not change.

The first set has five operations:

| Tool                                             | Function                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `list_publications(filters)`                     | Lists publications by date, section, and temporal cutoff.                  |
| `search_documents(query, strategy, filters)`     | Finds candidate documents with BM25, vectors, or hybrid search.            |
| `search_evidence(query, document_ids, strategy)` | Searches chunks only within already-discovered documents.                  |
| `get_document_outline(document_id)`              | Shows headings, sizes, and chunk index to navigate a document.             |
| `read_chunks(chunk_ids, neighbor_window)`        | Reads the final text and, if needed, its neighboring chunks.               |

The difference between the two searches is crucial. `search_documents` answers “which publication should I review?”. `search_evidence` answers “which passage in those publications contains the answer?”. The second one does not search again across the 6.73 million chunks: it works over the bounded set of candidates.

The contract supports `lexical`, `vector`, and `hybrid` strategies, but the runs described here used only lexical search. The vector index was still incomplete; mixing it in would have confused the quality of the method with the coverage available in the index.

The contracts also make limitations explicit. Today we can filter reliably by date, date range, and morning, evening, or extraordinary section. We still do not offer general filters by institution or document type because that metadata is not normalized for the whole corpus. The tool rejects a filter it cannot fulfill rather than pretending it applied it.

## An example: the 2026 minimum wages

Consider this v4 question:

> ¿Cuáles son los salarios mínimos generales diarios que rigen en 2026 para la zona general y la frontera norte?

First we discover the publication:

```text
search_documents(
  query="salarios mínimos generales diarios 2026 zona general frontera norte",
  strategy="lexical",
  filters={"as_of": "2026-04-24"},
  top_k=20
)
```

Document `651143`, a CONASAMI resolution published on December 9, 2025, appears as a candidate. That is still not evidence: it only tells us where to continue.

Then we search within those documents:

```text
search_evidence(
  query="salarios mínimos generales diarios 2026 zona general frontera norte",
  document_ids=[651143, ...],
  strategy="lexical",
  top_k=20
)
```

Chunk `6632609` contains both values: 315.04 pesos per day for the general zone and 440.87 for the Zona Libre de la Frontera Norte. Before answering we can read the chunk and its neighbors:

```text
read_chunks(chunk_ids=[6632609], neighbor_window=1)
```

Neighbors help when a heading, a date, or a condition fell right at the boundary between two chunks. They also leave a concrete provenance for the citation.

## Why BM25 and not a homemade score

The prototype ranked chunks by word matches and also favored longer fragments. Two texts with the same matches could end up in a different order just because of their length.

Internal search now uses BM25. The method rewards frequent terms within a fragment, reduces the weight of words that appear in almost every fragment, and normalizes length. At this stage it is enough to apply it to the small set of chunks from the candidate documents. Later we can replace it with FTS5 or with a reranker without changing the `search_evidence` contract.

Later runs revealed cases where literal matching was also insufficient. We then added structural signals that can be inspected:

- full identifiers such as `NOM-035-STPS-2018` receive priority when they appear in the issuing source title;
- exact headings such as `8.5` outrank a paragraph that only mentions that number;
- names such as “Ley General de Aguas” or “Plan Nacional de Desarrollo 2025-2030” can be searched in titles and heading paths;
- for queries like `INEGI INPC UMA`, the publications list shows title and institution to distinguish INEGI from a publication that only mentions UMA inside a fine.

These rules are deterministic. Results keep the BM25 score and show separately any boost applied to the title; that way we can know why the order changed.

## Evidence must be verifiable

A chunk is not delivered directly from just any text file. It is reconstructed from the compressed corpus using its offset recipe; before returning it, the tool computes its hash and compares it with the one recorded during chunking. If the content changed, the read fails.

The answer layer applies another rule: a chunk can only be cited if it was obtained through `read_chunks`. An ID appearing in `search_evidence` helps decide what to read, but it does not yet authorize a citation. This prevents a model from presenting a source it never saw as consulted.

This does not by itself prove that the citation supports the claim. It does guarantee basic provenance and allows a later evaluation to review the relationship between claim and passage. Each run also records the version of the corpus, chunker, and indexes.

## What the first numbers say

The evaluation separates the same two stages as the tools. First we measured whether BM25 found the reference publications across the entire corpus:

| Document-level metric                        |  BM25 |
| -------------------------------------------- | ----: |
| MRR of the first correct document            | 0.221 |
| Document recall@5                            | 0.381 |
| Document recall@10                           | 0.429 |
| Questions with all their documents in top-10 | 0.405 |

A document recall@10 of 0.429 means that, on average, more than half of the reference documents fell outside the top ten positions. The last row is even stricter: for multi-hop questions it requires all necessary documents to appear in the top-10.

Then, without changing that initial document selection, we compared how chunks were ranked within the candidates:

| Metric                            | Prototype | New tools |
| --------------------------------- | --------: | --------: |
| MRR of the first evidence chunk   |     0.092 |     0.104 |
| Evidence recall@1                 |     0.060 |     0.048 |
| Evidence recall@5                 |     0.083 |     0.167 |
| Evidence recall@10              |     0.155 |     0.187 |

The reading is mixed. Coverage within the top five positions doubled, but the first result worsened slightly and MRR barely rose. In absolute terms, both systems still recover little evidence: they are research baselines, not results sufficient for a product.

The two MRRs do not measure the same thing. One ranks publications and the other ranks chunks within a candidate set. Moreover, MRR only considers the position of the first correct result. A list, a year-over-year comparison, or a cross-reference may find one passage early and still omit the others. For those questions we also need to measure coverage of all documents and of every part of the answer.

That requirement led us to the next experiment. In [the second article](../agente-dof-evidencia-cobertura/) we connect these tools to a model, follow their decisions, and check what happens when finding one passage is not enough to answer the whole question.
