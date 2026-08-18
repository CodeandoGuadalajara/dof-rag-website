---
title: 'An Agent That Knows When It Is Missing Evidence: First Runs on the DOF'
description: 'How we built a bounded tool loop, turned the parts of a question into verifiable requirements, and evaluated its answers on the DOF.'
date: '2026-08-16'
heroImage: ''
category: 'development'
tags:
  ['dof-rag', 'agentic-rag', 'tools', 'evaluation', 'evidence', 'kimi']
author: 'Joaquín Bravo Contreras'
---

## From Isolated Tools to a Full Trajectory

In the [previous article](../herramientas-recuperacion-agente-dof/) we separated the search for publications from the retrieval of passages. The result was five deterministic tools: list publications, search documents, search evidence, browse a document index, and read chunks.

The next step was to let a model decide how to combine them. We did not want the model to search without limits, nor did we want a fluent answer to hide an incomplete retrieval. We built a small orchestrator: at each turn the model requests a tool with structured arguments or delivers the final answer.

```
question
   ↓
model ── requests tool ──→ validator ──→ DOF-RAG/SQLite
   ↑                                      │
   └──────── result + call_id ────────────┘
   │
   └── JSON response → citation and coverage validation
```

The trajectory has states: discover documents, discover evidence, read chunks, and respond. The model only sees the operations valid for the current state. There is a maximum of eight tool calls and, depending on the evaluated version, between six and eight turns. If it does not gather the required evidence within those limits, the run ends as incomplete.

The limits are not only about controlling cost. They also make runs comparable: a configuration that needs eight searches for a question does not behave like one that resolves it in three.

## Strict Arguments and Visible Errors

Each tool is described by a strict JSON schema. For example, `read_chunks` accepts between one and eight IDs, allows at most one neighbor on each side, and rejects additional properties:

```json
{
  "name": "read_chunks",
  "strict": true,
  "parameters": {
    "type": "object",
    "properties": {
      "chunk_ids": {
        "type": "array",
        "items": { "type": "integer" },
        "minItems": 1,
        "maxItems": 8
      },
      "neighbor_window": {
        "type": "integer",
        "minimum": 0,
        "maximum": 1
      }
    },
    "required": ["chunk_ids", "neighbor_window"],
    "additionalProperties": false
  }
}
```

The server re-validates the arguments before querying the databases. A date past the cutoff, a document the agent never discovered, or a chunk that did not appear in a previous search produces a structured error. The model can correct the call on the next turn, but it cannot silently widen the scope of the query.

Each trace keeps the turn, tool, arguments, result, timing, and `call_id` that links the request with the response. It also records tokens, latency, index versions, termination reason, and rejected citations.

## First Sample: Closing Is Not the Same as Answering Well

The first sample used Kimi K2.7 Code, BM25, and seven questions: one per v4 category. All seven runs ended with a valid JSON object, but manual review counted only two correct answers, two partial, and three unresolved.

That contrast was more useful than a 7/7 closure rate. It showed that validating the form of an answer does not guarantee the agent assembled all of its parts.

| Observed failure | Change made | What we wanted to achieve |
| ----------------------------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| It chose another publication from the same day | Show title and institution | Recognize the source, not an incidental match |
| It confused norms that shared a number | Prioritize full identifiers and titles | Retrieve the issuing norm |
| It read only one year of a comparison | Record coverage requirements | Block closure until both documents are read |
| It closed with valid JSON but insufficient evidence | Require reading and valid citations | Mark the run as incomplete |

The changes did not appear all at once. Each one responded to a trajectory we could inspect.

## Recognizing the Right Publication

A monitoring question asked what INEGI published on January 9, 2026. The date narrowed the universe, but several publications remained. One of them mentioned the UMA inside a sanction and could beat the correct document on lexical overlap.

`list_publications` originally returned date, section, path, and ID. We added title and institution extracted from the header so the agent could see the difference:

```text
652586  INSTITUTO NACIONAL DE ESTADISTICA Y GEOGRAFIA
        ÍNDICE nacional de precios al consumidor

652600  Secretaría de Seguridad y Protección Ciudadana
        PUBLICACIÓN DE SANCIÓN
```

We also added deterministic expansions for `INEGI`, `INPC`, and `UMA`. They are not synonyms generated during the run: the same query always produces the same terms.

Another group of questions confused norms with similar numbers. `NOM-035` does not identify a single norm on its own: it exists in different sectors. When the query includes `NOM-035-STPS-2018`, the searcher checks whether the full identifier appears in the title and prioritizes the issuing source over agreements or calls for proposals that only cite it. The result exposes that score boost separately.

## Covering the Question Before Closing

Finding two documents still does not guarantee the agent reads both. In a comparison of 2025 and 2026 salaries, both documents appeared among the candidates, but the first run only read the 2025 passage and answered with half of the information.

The run state now keeps verifiable requirements:

```json
{
  "coverage": {
    "2025": true,
    "2026": false
  }
}
```

While any requirement remains false, the search and read tools stay available and the orchestrator rejects closure. The same mechanism works for a reference that starts with a transitory article and leads to section 5.2: reading the transitory covers the first hop, but not the obligation contained in 5.2.

Lists decompose similarly. If a question asks for obligations for centers with up to 15 workers, between 16 and 50, and more than 50, the runner registers three requirements. A single passage does not count as a complete list just because it contains one of the ranges.

These rules are not a general decomposition of legal language. They recognize explicit patterns observed in v4: compared years, ranges, sections, PND periods, normative identifiers, and some legal actions. Their advantage is that they can be tested; their limit is that they still do not cover every way a sub-question can be phrased.

## Citing Something Read and Correcting a Premise

The final schema requires at least one citation, but that condition must be checked twice. A list like `[999]` satisfies the JSON type even if the agent never read that chunk. After removing unauthorized IDs, at least one valid citation must remain; otherwise closure is rejected.

False premises need an extra restriction. “No encontré el artículo 99” does not prove the article does not exist. To mark a premise as false, the agent must cite evidence, cover the anchors of the question, and formulate an affirmative correction. If it can only report a failed search, it must answer that the situation is unclear.

The code checks provenance, coverage, and the form of the correction. It does not decide by regular expression whether the legal interpretation is true. The relationship between claim and passage still requires human review.

## What Changed in the Runs

The progression is clearer when formal closure is separated from substantive correctness:

| Run | Scope | Valid closures | Manual review |
| ------------------------------------ | ------------------------------ | --------------: | ----------------------------------------------------- |
| First loop | 7 questions, one per category | 7/7 | 2 correct, 2 partial, 3 unresolved |
| After identity and coverage | The same 7 questions | 7/7 | 6 correct, 1 partial |
| Full run from `ba4e954` | 42 questions | 41/42 | 35 correct, 3 partial, 4 incorrect or pending |
| Contracts over pending cases | 7 selected failures | 5/7 | 4 correct, 1 incorrect, 2 unresolved |

The last row should not be compared as if it were a random sample: it contains exactly seven failures from the previous run. That only five closed means the contracts stopped accepting some partial answers, not that the whole system fell from 41/42 to 5/7.

Two cases illustrate the difference. [MD-002](../../../../evals/v4/#md-002) asked how the daily, monthly, and yearly UMA values changed between 2025 and 2026. The agent read and cited the publication for each year before comparing the three values.

[MD-004](../../../../evals/v4/#md-004) asked for a different kind of reconstruction: the sequence from the two publications of a declaration of public utility to the expropriation decree for 14 properties for the Tren Maya, including deadlines for submitting evidence and contesting compensation. The task required evidence from three publications. The agent did not assemble the complete sequence within the budget and ended as incomplete coverage. It did not answer the question, but it correctly described the limitation of that run.

Automatic metrics also need context. Citation precision and recall are calculated only over runs with valid closure; the closure rate is reported separately. Also, v4 may penalize an alternative chunk that contains the same evidence but is not annotated in the reference set. A matching citation helps verify provenance, but it does not replace reading the answer.

## V4 Became a Development Set

There is a larger methodological limitation. The failures in v4 were used to design several rules: institutional abbreviations, normative identifiers, periods, lists, and multi-document requirements. Its 42 questions became, in practice, our development set.

The results show that the fixes resolved observed cases, that the agent can gather evidence through multiple paths, and that the runner blocks more incomplete closures. They do not yet prove that the rules generalize to new questions.

V4 will remain useful as a regression test. The next result that can measure generalization needs a new, locked set: we must write and annotate its questions before running the system, freeze the code, and avoid adding rules after seeing the answers.

After that we can compare BM25 with hybrid search when the vector index has exact, reportable coverage. The comparison must hold constant the questions, limits, model, and contracts. We also need to represent multi-document sub-questions better and record alternative evidence in the evaluation set.

The progress of this milestone is not a final quality number. It is that we can now distinguish a complete answer from a valid JSON object, trace where each citation came from, and declare which part of a question still lacks evidence.
