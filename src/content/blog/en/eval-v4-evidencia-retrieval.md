---
title: 'Eval v4: finding the document is not enough; the evidence must be found too'
description: 'We built a hand-crafted 42-question evaluation to measure complete lists, effective dates, legal references, multi-document queries, monitoring, and false premises. We ran it against full BM25 and a 38.2% vector index to set a baseline before finishing the embeddings.'
date: '2026-08-09'
heroImage: ''
category: 'development'
tags:
  [
    'dof-rag',
    'evaluation',
    'retrieval',
    'bm25',
    'vector-search',
    'hybrid-search',
    'rag',
  ]
author: 'Joaquín Bravo Contreras'
---

## The question the previous evaluation could not answer

The [v3 evaluation](/en/blog/2026/08/eval-bm25-corpus-completo/) helped us fix two important problems: titles that were really filenames and queries too ambiguous to single out one publication among thousands of similar documents. With 3,013 queries and 499 reference documents, it remains useful for comparing changes to the searcher.

But v3 measures a fairly limited task: given a query, at what position does **a known document** appear? It does not distinguish between these two results:

1. the system retrieved the correct document and also the paragraph containing the answer;
2. it retrieved the correct document but returned an irrelevant excerpt from that same document.

For anyone searching the Official Journal of the Federation (DOF), the difference is fundamental. A decree can run to a hundred pages. Knowing the answer “is in that decree” is not enough if the system does not locate the article, transitory provision, or table that supports it.

Not every question has a single correct document either. Two resolutions are needed to explain how the minimum wage changed from 2025 to 2026. Reconstructing an expropriation may require the first declaration, the second publication, and the final decree. If the searcher finds one of three documents, it has a partial success; if it finds all three, it has completed the task.

That is why we built **eval v4**, a small hand-reviewed sample that changes the unit of evaluation: it no longer records only the expected document, but also the chunks and exact citations needed to answer.

## What v4 contains

V4 has 42 questions in Spanish: six questions in each of seven categories. It does not aim to replace v3's 3,013 queries. It serves another purpose: testing query types closer to the actual work of someone searching for legal or administrative information.

| Category | Example | What it demands of the searcher |
| ----------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Single passage | What are the 2026 daily minimum wages in the general zone and the northern border zone? | Find a fact or definition in a specific passage. |
| Complete list | What are the seven purposes of Article 3 of the General Water Law? | Retrieve every element, not just one or two. |
| Timing and transitory provisions | When did the two phases of NOM-035 enter into force? | Interpret publication, effective date, and deferred obligations. |
| Cross-reference | What do items 8.3, 8.4, and 8.5 cited by the transitory provision of NOM-035 require? | Go from a legal reference to its content. |
| Multiple documents | How did general minimum wages change from 2025 to 2026? | Combine evidence from two or more publications. |
| Monitoring | What did INEGI publish in the DOF of January 9, 2026? | Use date, institution, and publication type as implicit filters. |
| False premise | When was the National Waters Law fully repealed in December 2025? | Detect that the question starts from a false fact and correct it with evidence. |

The last category deserves an explanation. The decree of December 11, 2025 enacted the General Water Law and amended, added, and repealed provisions of the National Waters Law. It did not fully repeal the latter. A system that tries to please the question may invent a repeal date; one that properly queries the corpus must point out the error before answering.

Each v4 record contains:

- the question and a reference answer;
- a user or use context, such as human resources, treasury, journalism, or legal practice;
- difficulty and cutoff date (`as_of`);
- indication of whether the question can be answered or starts from a false premise;
- number of required document hops;
- identifiers and paths of the correct documents;
- chunk identifiers;
- textual citations that support the answer.

The corpus is also frozen by version: `dof-full-v1`, with 657,867 documents published between January 4, 1999 and April 24, 2026. The chunker is fixed as `dof-chunker-v1`. This keeps us from comparing two runs that, without saying so, used different texts or cuts.

## Citations are not decoration

The first version of the records had readable citations, but some joined two separate sentences while omitting words in between. For a human explanation that may be acceptable; as reference evidence, it is not.

We built a deterministic validator that regenerates each chunk from the original Markdown and checks that the normalized citation is a contiguous sequence within it. It also checks:

1. that there are exactly 42 questions and six per category;
2. that there are no duplicate identifiers or questions;
3. that the corpus version, size, and dates match;
4. that document, path, date, and section correspond in the database;
5. that chunk, document, index, and versions correspond to one another;
6. that multi-document questions have at least two documents and two hops;
7. that false-premise questions include a supported correction.

The final validation came to **42 questions, 14 documents, and 31 distinct evidence chunks**. That there are only 14 documents is a deliberate limitation of this first version: we preferred a small sample we could audit completely before expanding topical coverage.

## How we measure an answer that spans multiple documents

MRR is still useful, but it no longer suffices on its own.

### MRR: how soon the first useful source appears

MRR means _Mean Reciprocal Rank_, the average of the inverse of the position. If the first correct document appears at position 1, the query contributes 1. If it appears at position 2, it contributes 0.5; at position 10, 0.1. A query with no correct document within the evaluated depth contributes 0.

This metric rewards having at least one useful source appear early, but a multi-document question can get a good MRR even when half the answer is missing.

### Document recall: how much of the document evidence appeared

Suppose a comparison requires the 2025 and 2026 wage resolutions. If the top 10 contains only the 2026 one, document recall is 1/2, or 0.5. If it contains both, it is 1.

### All-hop recall: whether all required sources appeared

For the same question, `all-hop@10` is 1 only if both resolutions appear in the first ten results. Finding one of two is worth 0. It is a stricter metric, but it better matches an answer that needs to complete several steps.

### Evidence chunk recall: whether the right passage appeared

Vector search returns chunks, so we also measure how many reference chunks appear in the first 1, 5, 10, and 20 results. This is the test that separates “I found the decree” from “I found the paragraph that answers.”

## Three searchers over two indexes in different states

We ran v4 against the components that exist today:

- **Full document BM25** over the 657,867 documents. BM25 favors word matches, especially rare terms, numbers, names, and references.
- **Partial binary Jina**. The original embedding has 1,024 numbers. To save space we store one bit per number: 1 if positive, 0 if negative. The query is represented the same way and sqlite-vec orders by Hamming distance, that is, by how many bits differ between the two.
- **Hybrid search**, which combines the BM25 and vector lists. We tried RRF —which combines ranks— and three weighted blends. `W0.75`, for example, assigns 75% of the weight to BM25 and 25% to the vector component after normalizing each list's scores.

The vector index was not finished. At the time of the run it contained **2,574,336 of 6,730,304 chunks: 38.2%**. Because construction proceeds in chronological order, only two of v4's fourteen reference documents were included. This leaves three questions fully covered by vectors:

- `SP-002`: exchange rate obtained on August 9, 2006;
- `MD-003`: comparison of exchange rates on August 8 and 9, 2006;
- `MO-002`: publications by Banco de México on August 10, 2006.

We report two subsets. The first uses all 42 questions and represents the system as it exists today, though it mixes quality with lack of coverage. The second uses only those three questions; it is fair to the vector component, but too small to choose a final configuration.

## Results on the 42 questions

| System | MRR | Document recall@5 | Document recall@10 | All-hop@10 |
| ----------------- | --------: | ------------------: | -------------------: | ---------: |
| Hybrid W0.75 | **0.237** | 0.381 | 0.429 | 0.405 |
| BM25 | 0.221 | 0.381 | 0.429 | 0.405 |
| Hybrid W0.5 | 0.118 | 0.167 | 0.381 | 0.357 |
| RRF | 0.114 | 0.131 | 0.333 | 0.310 |
| Hybrid W0.25 | 0.046 | 0.036 | 0.107 | 0.095 |
| Partial vector | 0.014 | 0.036 | 0.036 | 0.024 |

The vector result of 0.014 is not an evaluation of the Jina model: 39 of the 42 questions do not have all their documents in the index. It is, primarily, a measurement of incomplete coverage.

The W0.75 blend improves BM25's MRR from 0.221 to 0.237, a relative increase of 7.2%, but does not change recall. The available vectors help reorder some documents that BM25 had already retrieved; they still cannot add coverage for recent publications that are not embedded.

The breakdown by category shows where BM25 is working:

| Category | BM25 MRR | Hybrid W0.75 MRR |
| ----------------------- | -------: | ----------------: |
| Single passage | 0.500 | 0.500 |
| Multiple documents | 0.282 | **0.391** |
| Timing and transitory provisions | 0.255 | 0.252 |
| False premise | 0.208 | 0.208 |
| Complete list | 0.151 | 0.150 |
| Monitoring | 0.097 | 0.102 |
| Cross-reference | 0.056 | 0.053 |

Single-passage questions contain strong anchors: a year, a figure, an institution, or a regulation name. BM25 responds well to that pattern. Cross-references are different: the question may mention “item 8.5,” while the passage we need explains “first level,” “second level,” and “third level.” Sharing few terms makes semantic retrieval more important, and probably a second model that more carefully re-ranks a short candidate list.

## The small subset where vectors do have coverage

| System | MRR | Document recall@10 | All-hop@10 |
| ----------------- | --------: | -------------------: | ---------: |
| RRF | **0.389** | 0.500 | 0.333 |
| Hybrid W0.5 | 0.364 | 0.167 | 0.000 |
| Hybrid W0.75 | 0.343 | 0.167 | 0.000 |
| Hybrid W0.25 | 0.278 | 0.500 | 0.333 |
| Partial vector | 0.194 | 0.500 | 0.333 |
| BM25 | 0.111 | 0.167 | 0.000 |

Here fusion again beats each component separately. It is a signal consistent with earlier evaluations, not a conclusion: three questions over two daily Banco de México publications are far from representing the seven categories.

Exact passage retrieval also remains pending. On the three covered questions, average evidence chunk recall was **0.111 at top-20**, and none recovered all of its required chunks within the first twenty positions. One correct chunk appeared at position 3, others at 84 and 184. Collapsing chunks to the document can make the correct document rise, but passages that deep would not fit into the context sent to the generator model.

This suggests a useful architecture split:

1. retrieve candidate documents with BM25 and vectors;
2. search more deeply inside those documents;
3. re-rank chunks before building the final context.

There is no need to decide yet which model will do that second ordering. The evaluation already defines what needs to improve: evidence recall in top-10 or top-20 without losing all-hop document recall.

## What we can conclude and what we cannot

The run establishes four things:

1. **V4 can be run end to end.** Questions, documents, chunks, citations, and metrics are connected to the real databases, not to an in-memory sample.
2. **BM25 sets a full baseline.** MRR 0.221, document recall@10 of 0.429, and all-hop@10 of 0.405 on the 42 questions.
3. **Fusion can improve ranking.** W0.75 raised MRR without expanding the retrieved set; in the small covered subset, RRF was best.
4. **Finding the document does not guarantee finding the evidence.** Ranks 84 and 184 are too deep for a practical RAG pipeline.

We cannot conclude which hybrid blend should be used in production. The apparent contradiction —W0.75 wins on the 42 questions, RRF wins on the three covered ones— is explained by coverage. In the first subset it pays to rely almost entirely on BM25 because most vectors do not exist; in the second, vectors can compete, but the sample is minimal.

When indexing finishes we will repeat the exact same command on the same 42 questions. That run will be comparable because the dataset, corpus, chunker, depths, and fusion formulas were recorded. The main difference will be a single one: the vector index will have the 6.73 million chunks.

## What is still needed to turn v4 into a quality gate

V4 is a pilot, not a final exam. Before using any of its numbers to approve or reject system changes, four steps are missing:

1. **Independent review.** A second person with legal or domain experience must review every answer and every citation.
2. **More DOF areas.** The current sample concentrates on labor, monetary indicators, water, national planning, and expropriation. Missing are health, taxes, customs, procurement, environment, and social programs.
3. **Development-test separation.** The documents used to tune weights or re-ranking models must not be the same ones that decide whether a change improves things.
4. **More relevance judgments.** Some questions admit several valid sources. The set must record graded relevance and alternative documents, not force a single correct source when the task does not require it.

The important change in v4 is not the size —42 questions are few— but the contract. A good answer needs complete sources, concrete passages, and the ability to reject an incorrect premise. Now we can measure those three things separately and observe where each stage of the searcher fails.

## Help us review the dataset

We have published a [Spanish-language review edition of the 42 questions](/dof-rag-website/es/evals/v4) with their answers, cutoff dates, and reference citations. We are looking for observations on ambiguous questions, incomplete answers, effective-date problems, and alternative sources that should also be accepted.

There is no need to review the whole set. One well-supported correction on a single question is useful and will be recorded before v4 becomes a quality gate.
