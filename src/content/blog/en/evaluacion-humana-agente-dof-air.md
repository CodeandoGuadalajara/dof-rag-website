---
title: 'From Automated Evaluation to Human Testing of the DOF Agent'
description: 'How we built a local application to test the agent with new questions, stream its verifiable process, and store answers and feedback without waiting for the vector index.'
date: '2026-08-18'
heroImage: ''
category: 'development'
tags: ['dof-rag', 'human-evaluation', 'air', 'sse', 'sqlite', 'traceability']
author: 'Joaquín Bravo Contreras'
---

## The next set of questions was not in a file

Automated evaluations allowed us to measure retrieval, citations, and coverage
over known questions. They also helped us correct specific agent failures. But
they had an unavoidable limitation: after several iterations, those questions
had already influenced the design of the system.

The next step was not to add more rules to v4, but to observe what happens when
a person asks a new question. For that, we needed more than an evaluation
script: we needed an interface where someone could ask a question, wait for a
run that may take tens of seconds, review the sources, and explain why an answer
was useful or insufficient.

[`dof-rag` PR #68](https://github.com/CodeandoGuadalajara/dof-rag/pull/68)
builds that first testing site. It is a small application running on the same
MacBook that stores the corpus, with controlled access through Tailscale. It is
not yet intended to be a public service, but it does let us explore ways to open
the project beyond prepared evaluations and demonstrations. Its purpose is to
turn human use of the agent into observations that we can review and reproduce.

This work continues the [bounded tool loop](../agente-dof-evidencia-cobertura/),
but changes the engineering question. Previously, we wanted to know whether the
agent could correctly close 42 annotated cases. Now we need to know what a
person saw, what the agent did while they waited, and what information we must
keep to understand their evaluation days later.

## A first audience at PyCon Latam

This week we are taking the project to
[PyCon Latam 2026](https://pylatam.org/), the Python conference held in Costa
Rica from August 20 to 23. Along with presenting the work behind DOF processing,
retrieval, and evaluation, we plan to show this interface to a small group of
attendees.

This test has a different purpose from a demonstration with prepared questions.
We want to observe what someone who did not participate in development asks,
whether they understand the cutoff date and number of required documents, how
long they consider a reasonable wait, and what they need to see before trusting
— or distrusting — an answer.

The conference is a useful setting for this first exposure. A technical audience
can recognize the limitations of a service running from a laptop while still
asking questions that do not belong to v4. Access will remain invitation-only
and strictly limited. This is not an open launch; it is a controlled way to
learn what would have to change before the project could be offered through
other channels.

## An application next to the agent, not inside the blog

The first option was to add the interface to this blog's Astro site. That would
have coupled two components with different lifecycles: the blog is static and
published on GitHub Pages, while the agent needs Python, local SQLite databases,
provider keys, and a continuously running process.

The application ended up inside `dof-rag`, next to the code that runs the agent:

```text
browser
    │ HTML, forms, and Server-Sent Events
    ▼
Air application
    ├── session, CSRF, and usage limits
    ├── local queue + one worker
    └── evaluation SQLite database
             │
             ▼
      AgentRunner + DofToolbox
             │
             ├── corpus and chunks opened read-only
             └── model provider
```

We chose [Air](https://airwebframework.org/) because it makes it possible to
define routes, HTML, and the ASGI lifecycle with little code. The initial
interface could change several times in an afternoon without introducing a
separate front end. The important logic does not depend on the framework:
contracts, persistence, queue management, and the agent adapter live in
separate modules. If the web layer changes, the run log does not have to change
with it.

The repository uses Python 3.12, so we pinned Air 0.35.0. Later releases require
Python 3.13. This is a pragmatic decision for the pilot, not a permanent
platform choice.

The single-origin architecture also simplifies security. Kimi or OpenAI keys
remain in process environment variables; the browser never receives credentials
or database paths. The application does not enable CORS, and the client cannot
submit SQL queries or arbitrary tool arguments.

## Creating a run and checking its status

An agent answer can take 30, 40, or more seconds. Keeping one HTTP request open
for that entire period makes it difficult to distinguish a slow run from a lost
connection or a stopped server.

Instead, the form creates a run and immediately receives an identifier. The
state follows a small state machine:

```text
queued ──→ started ──→ succeeded
                    └─→ failed
```

The browser then loads the page for that run. A worker thread takes jobs from a
bounded queue and invokes the agent outside the request that created them. If
the phone changes networks or the tab closes, the job continues.

The public contract accepts only four fields:

```text
question           3 to 2,000 characters
as_of              optional cutoff date
required_hops      between 1 and 5 required documents
client_request_id  identifier for safe retries
```

`client_request_id` solves a common form problem: a double tap or resubmission
after losing connectivity should not charge for and run the same question
twice. The evaluator and identifier pair is unique. Repeating it with the same
input returns the existing run; attempting to reuse it for a different question
produces a conflict.

The MVP allows one active run per evaluator, a global queue of twenty, and a
single worker. These numbers protect a laptop and make the scope explicit:
admission is safe within one process, not across several server replicas.

## What it means to stream the agent's work

The first version only showed that a run was in progress. The next one streamed
technical events, but the result was a list of JSON that was difficult to
interpret. The useful information for a person is not that call number four
finished, but what the agent was trying to establish and what it found.

We therefore built a public log of observable decisions. Its events include:

- the overall research objective;
- the start of a model turn;
- the selected tool and its validated arguments;
- why that operation is necessary at that point in the flow;
- candidate documents and returned passages;
- requests to revise an incomplete answer;
- the result of citation and coverage verification.

For example, before `read_chunks`, the interface can show:

```text
Reading chunk 6632609 to verify the evidence.
Only chunks that have been read can become evidence and citations in the answer.
```

When the operation finishes, the ID becomes a compact link. Expanding it shows
the document, heading path, and a bounded excerpt. This makes it possible to
follow the trajectory without covering the screen with full blocks from the
Official Journal of the Federation (DOF).

This log is not the model's private chain of thought. We do not store or display
internal tokens, answer drafts, or hidden reasoning. Besides not being a stable
interface across providers, those tokens can contain discarded hypotheses and
unverified text. For evaluation, more concrete signals are useful: which
operation was requested, with what scope, which documents were returned, which
text was read, and which rules passed or failed.

The distinction makes the trace more useful. “The model thought this looked
like the right decree” is difficult to verify. `search_documents` returned
document `651143`, followed by `read_chunks` reading passage `6632609`, are
facts that we can reproduce.

## SSE for following a run without tying it to the connection

Events are streamed with Server-Sent Events (SSE), a simple protocol over HTTP
for sending a sequence from the server to the browser:

```text
id: 7
event: progress
data: {"sequence":7,"event_type":"tool_completed",...}
```

Each event has an increasing number within its run. If the connection is lost,
the browser sends the last received ID again and the server replays only later
events. When the terminal event arrives, the page requests the fragment with
the complete answer. Conventional polling remains as a fallback for browsers
without SSE.

The stream is not the source of truth either. Each step is stored in SQLite
first; SSE only transports what has already been persisted. Reloading the page
reconstructs the same “Research process,” and that block remains available —
collapsed and expandable — after the final answer appears. It opens by default
for a failed run to make diagnosis easier.

The implementation queries SQLite every 500 milliseconds for each connected
client. That is enough for a few people in a pilot. It would not be a good
architecture for hundreds of simultaneous streams; that scenario would require
worker notifications, longer intervals, or a shared broker.

## Finding a chunk is not the same as reading it

The interface made visible a distinction that already existed in the agent
contract. `search_evidence` returns candidate passages, while `read_chunks`
returns the text that can support a citation. `get_document_outline` also
returns a property called `chunks`, but each entry there only describes document
structure: position, heading, and size.

In the first real test, the public adapter treated every `chunks` property as
read evidence. When processing an outline, it looked for text and a
`document_id` that the structure was not supposed to include. The run failed
before it could display the answer.

The fix was not to fill in fields that did not belong there. The adapter now
classifies the result according to the tool that produced it:

```python
chunks = data.get("chunks", []) if name == "read_chunks" else []
```

Only `read_chunks` can produce expandable, citable passages. The outline still
helps with navigation, but it is not presented as something the agent has
already read. A regression test runs both tools and checks that distinction.

This is a small detail with a general consequence: two objects having the same
key does not mean that they represent the same concept. The provenance of a
piece of data is part of its type.

## Storing questions, answers, and feedback

We decided to store the questions. Without them, an assessment such as “missing
evidence” does not let us reconstruct what was asked, what the cutoff date was,
or how many documents the person expected. We also store the exact answer,
citations, documents, passages, coverage, and public process.

The evaluation database is separate from the corpus and indexes. Its schema is
organized around four main tables:

| Table          | Contents                                                       |
| -------------- | -------------------------------------------------------------- |
| `runs`         | question, cutoff, hops, pseudonymous evaluator, and provenance |
| `run_events`   | `queued`, `started`, `succeeded`, or `failed` transitions      |
| `run_progress` | ordered, reconnectable public steps                            |
| `feedback`     | rating, problem types, and optional comment                    |

Transitions and feedback are append-only whenever possible. A successful run
is not rewritten into a failure, and a second rating does not erase the first.
SQLite uses WAL and a fresh connection per operation so that the HTTP thread
and the worker do not accidentally share a connection.

Feedback offers three ratings — helpful, partially helpful, and not helpful —
and a controlled vocabulary of problems: incorrect answer, missing evidence,
bad citation, incomplete coverage, cutoff-date error, difficult to understand,
or other. It also accepts a short comment.

None of this modifies v4 automatically. An interesting human question can later
become a candidate for v5, but it needs review, a reference answer, and annotated
evidence before entering an evaluation set. Feedback helps discover cases; it
does not create ground truth by vote.

## Reproducibility beyond the text of the answer

Two runs with the same question can change because the code, model, or index
changed. For that reason, each row in `runs` captures the following before the
job is queued:

- Git revision and whether local changes were present;
- corpus and chunker versions;
- vector-index availability and fingerprint;
- provider, model, and reasoning effort;
- turn and tool limits;
- retrieval mode.

Provenance also distinguishes `vector_available` from `vector_used`. During
this pilot, the vector file may exist while remaining incomplete, but the
executor uses lexical retrieval. Recording only “an index exists” would
attribute to vectors an answer in which they never participated.

This separation lets us test the interface without waiting for indexing to
finish. Later, we can compare lexical and hybrid retrieval without changing how
a run is stored.

The same reproducibility review covered repository files.
`scripts/eval_v4_full.py` and the canonical retrieval report are code and
methodological documentation, so they were versioned. Run JSON, caches,
databases, logs, and failure lists remain generated artifacts: they are kept
locally but not mixed with experiment code. Distinguishing the recipe, report,
and result is necessary to repeat an evaluation without deleting evidence from
earlier runs.

## Process shutdown is also part of the contract

A PR review found a less visible operational case. `close()` sent a sentinel to
the queue with a blocking write. If the queue was full and the worker was
waiting for a provider response, shutting down the server could block. In
addition, after the timeout, the thread could receive the response and store a
success even though the service already considered itself closed.

Shutdown now performs four actions:

1. it stops admitting new jobs;
2. it sets a shutdown event shared with the worker;
3. it attempts to insert the sentinel without blocking;
4. it drops and logs any late progress at debug level.

A lock coordinates the shutdown transition with writes. If the provider
continues after the timeout, it cannot add a late terminal state. When a new
instance starts, a run that had begun is marked as interrupted, while jobs that
were still queued are recovered.

The corresponding test contains more code than the fix: it blocks an executor,
fills the queue, measures that `close()` returns quickly, releases the late
response, and starts a new service over the same database. That path verifies
the behavior that matters, not merely that a method can be called.

## A deliberately small pilot

The application uses individual invitations, signed sessions, CSRF protection,
`HttpOnly` cookies, evaluator isolation, body limits, and security headers. The
corpus databases are opened in `query_only` mode. Uvicorn's access log is
disabled so that client IP addresses do not become part of the evaluation
dataset; any proxy will need to adopt or declare its own policy.

Known limits remain. The queue and rate limiter live in memory. Air is pinned
to an earlier release because of Python 3.12. The CSP temporarily allows inline
scripts and styles. The laptop still needs a supervisor and a stable HTTPS
tunnel before inviting a larger group. SSE polling and a single worker only
make sense at this scale.

The result of this session is not a finished front end. It is a minimal loop for
asking a new question, observing verifiable operations, reviewing sources,
storing the answer, and associating it with structured feedback. With that loop,
we can present a first interface at PyCon Latam and begin finding failures that
v4 was no longer able to reveal, without confusing a small-audience test with a
production-ready service.
