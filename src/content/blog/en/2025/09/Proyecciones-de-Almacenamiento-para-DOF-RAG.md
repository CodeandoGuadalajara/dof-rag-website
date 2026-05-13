---
title: Storage Projections for DOF-RAG
date: 2025-09-12T06:00:00.000Z
author: DOF-RAG Team
description: >-
  A detailed analysis of storage projections for the DOF-RAG project, evaluating
  different embedding dimensions and their scalability implications over a 25-year
  horizon.
image: /images/posts/2025/09/duckdb_vs_dof.png
tags:
  - escalabilidad
  - proyecciones
  - embeddings
  - almacenamiento
  - DOF-RAG
---

The choice of embedding dimension is a fundamental architectural decision that directly impacts the scalability and technical viability of RAG systems in the long term. This analysis presents storage projections for DOF-RAG over a 25-year horizon, based on empirical measurements from real databases containing documents from **January 2025** of Mexico's Official Journal of the Federation (10,090 processed chunks).

## DOF-RAG Project Context

The DOF-RAG project aims to democratize access to information from Mexico's Official Journal of the Federation through a retrieval-augmented generation (RAG) system. One of the most important architectural decisions was the choice of embedding dimension, as this decision determines both the semantic quality of searches and the scalability of the system.

### The Challenge of Long-Term Planning

The DOF is published daily and will continue to be for decades. For a system designed to preserve and facilitate access to government information, infrastructure planning requires rigorous analysis of storage implications over extended horizons.

### Analysis Methodology

The analysis is based on direct measurements of three identical databases containing exactly the same 10,090 chunks from **DOF documents from January 2025**. The only variable between the databases is the embedding dimension: 512d, 768d, and 1024d. All vectors were generated using the **Qwen-0.6B** model, ensuring methodological consistency.

**Dataset limitations:** The analysis was limited to one month of DOF publications because the embedding generation process for different dimensions is computationally intensive and requires considerable time. The 10,090 chunks represent a representative sample of the typical volume and variety of DOF content.

**Important note on embedding models:** Although tests were conducted with Qwen-0.6B, models with higher dimensions exist, such as **Jina Embedding v4**, which can generate vectors of up to **2,048 dimensions**. The storage principles and overhead are applicable regardless of the model used, since the processed content (documents, pages, images) remains constant — **the only variable that changes is the embedding vector size**.

### Analysis Scenario: DOF at 25 Years

For the storage projections, we use an estimated scenario based on the DOF's historical publication patterns:

**Scenario parameters:**

* **Publication frequency**: 365 documents per year (daily publication)
* **Analysis period**: 25 years (initial volume estimate)
* **Total documents**: 9,125 documents
* **Pages per document**: 300 pages average (observed range: 50-2000 pages)
* **Chunks per document**: 300 chunks (1 chunk per page)
* **Images per document**: 15 images average (graphics, tables, institutional logos)

**Time horizon context:**
The DOF has existed for decades, so the DOF-RAG system is designed for **backward-looking** projection (digitizing existing historical archives) and **forward-looking** projection (processing continuous publications). The 25 years represent an **initial volume estimate** for infrastructure planning, not a temporal limit of the system.

**Justification for the page average:**
DOF documents show great variability in length. We have observed:

* **Short documents**: 50 pages (notices, appointments)
* **Long documents**: Up to 2,000 pages (complex regulations, budgets)
* **Weighted average**: 300 pages (considering the frequency of each type)

**Projected totals:**

* **Total chunks**: 2,737,500 records (9,125 × 300)
* **Total images**: 136,875 records (9,125 × 15)
* **Total documents**: 9,125 records

## Overhead Analysis Results

### Empirical Measurements

Real measurements from **January 2025 content** reveal consistent overhead factors across different embedding dimensions:

| Dimensión | Tamaño DB | Chunks | Tamaño/Chunk | Overhead | Factor    |
| --------- | --------- | ------ | ------------ | -------- | --------- |
| **512d**  | 216.3 MB  | 10,090 | 21.95 KB     | 14.95 KB | **3.06x** |
| **768d**  | 224.8 MB  | 10,090 | 22.81 KB     | 14.81 KB | **2.78x** |
| **1024d** | 249.0 MB  | 10,090 | 25.27 KB     | 16.27 KB | **2.74x** |

### Overhead Composition

The overhead in DuckDB includes additional structures that optimize system performance:

**Base structure per record:**

* Metadata: 20 bytes (id, document\_id, page\_number, created\_at)
* Content: \~5,100 bytes (text + header)
* Embedding: Variable (2KB-4KB depending on dimension)

**Overhead factors:**
Like any optimized database, DuckDB adds auxiliary structures to improve query performance, indexing, and transaction management. The observed overhead (\~3x) is consistent regardless of the embedding dimension.

### Efficiency Factors

The results show consistent overhead (\~3x) independent of dimension, suggesting that the additional cost is primarily structural, not proportional to the embedding size.

**Technical interpretation:** The similar overhead across dimensions indicates that DuckDB maintains fixed structures for optimization (indexes, statistics, metadata) that don't scale linearly with vector size. This means that dimension decisions can prioritize semantic quality over storage efficiency.

## DOF-RAG Storage Projections (Initial Estimate)

### Scenario Parameters

**Processing volume (25 years of content):**

* **Documents**: 1 per day × 365 days × 25 years = 9,125 documents
* **Chunks**: 300 per document = 2,737,500 total chunks
* **Images**: 15 per document = 136,875 images

**Note on scalability:** This estimate represents an initial reference volume. The system is designed to scale both to historical DOF content (previous decades) and to continuous future publications.

### Projections by Dimension

Applying empirically measured overhead factors:

**25-year projection:**

| Dimensión | Chunks (GB) | Documentos (MB) | Imágenes (MB) | **Total (GB)** |
| --------- | ----------- | --------------- | ------------- | -------------- |
| **512d**  | 57.30       | 3.56            | 267.33        | **57.56**      |
| **768d**  | 59.55       | 3.56            | 267.33        | **59.82**      |
| **1024d** | 65.98       | 3.56            | 267.33        | **66.24**      |

**1-year projection:**
For a more immediate perspective, annual projections are:

| Dimensión | Chunks Anuales | Almacenamiento Chunks | **Total Anual (GB)** |
| --------- | -------------- | --------------------- | -------------------- |
| **512d**  | 109,500        | 2.35 GB               | **2.35**             |
| **768d**  | 109,500        | 2.44 GB               | **2.44**             |
| **1024d** | 109,500        | 2.70 GB               | **2.70**             |

**Annual differences:**

* 768d vs 512d: +0.09 GB (+3.8%)
* 1024d vs 512d: +0.35 GB (+14.9%)

### Differences Analysis

**Storage increase (25 years):**

* 768d vs 512d: +2.26 GB (+4%)
* 1024d vs 512d: +8.68 GB (+15%)

**Storage increase (1 year):**

* 768d vs 512d: +0.09 GB (+3.8%)
* 1024d vs 512d: +0.35 GB (+14.9%)

### Scalability by Volume

| Cantidad de Chunks | 512d     | 768d     | 1024d    |
| ------------------ | -------- | -------- | -------- |
| **10,000**         | 214.8 MB | 223.4 MB | 247.5 MB |
| **100,000**        | 2.09 GB  | 2.17 GB  | 2.41 GB  |
| **1,000,000**      | 20.95 GB | 21.74 GB | 24.12 GB |

## Technical Recommendations

### Dimension Selection for DOF-RAG

Based on the empirical analysis and semantic quality testing, **we selected 768 dimensions** for DOF-RAG for the following reasons:

**768 dimensions - Final selection:**

* Overhead factor: 2.78x (more efficient than both 512d and 1024d)
* **25% space savings** compared to 1024d (59.82 GB vs 66.24 GB)
* **Preserved semantic quality**: In evaluation tests, responses maintain the same quality as with 1024d
* Optimal balance: Less data to store without loss of response quality

**Decision justification:** The difference of only 6.42 GB between 768d and 1024d may seem minor, but it represents a **cumulative savings of 10.7%** in total system storage. Considering that documentary content (267.33 MB of images + 3.56 MB of documents) remains constant, the optimization is concentrated specifically on embeddings where the impact is most significant.

### Scalability Considerations

**Universality of storage dimensions:**
The calculated storage factors are **universal for any specific dimension**, regardless of the model that generates the embeddings. A 1024-dimension vector will occupy the same storage space whether generated by Qwen, OpenAI, or any other model — the difference lies solely in the **internal semantic encoding** of the vector, not its physical size.

**Important**: Embeddings are specific to the model that generates them. It is not possible to interchange embeddings between different models, as each model has its own semantic encoding.

**Models with higher dimensions:**

* **Jina Embedding v4**: Capable of generating up to **2,048 dimensions** with superior semantic quality as vectors are double the size of 1024d ones
* **Inevitable tradeoff**: Higher dimension = greater semantic quality but also **double storage weight**
* **Model exclusivity**: These high-dimension embeddings only work with the specific model that generated them (Jina in this case)

**Calculation principle**: Overhead factors remain proportional — a 2048d vector will occupy approximately double that of a 1024d one, plus DuckDB's structural overhead.

**Projection example for 2048d:**
Applying the average factor of 2.8x, a 2048d vector would have approximately:

* Theoretical size: \~13.3 KB/chunk
* Estimated real size: \~37 KB/chunk
* For 2.7M chunks: \~100 GB (versus 66.24 GB for 1024d)

## Conclusions

### Key Findings

The empirical storage analysis for RAG systems reveals fundamental insights:

1. **Consistent overhead**: Overhead factors remain between 2.7x-3.1x regardless of embedding dimension, indicating that the additional cost is primarily structural.
2. **Model independence**: Storage patterns are universal for a specific dimension — the only variable factor is the embedding vector size, not the model that generates it.
3. **Linear scalability**: Storage growth is predictable and enables precise infrastructure planning.
4. **Focused optimization**: DuckDB's fixed structural overhead means that storage optimizations focus primarily on the embedding dimension choice.

### Architectural Decision for DOF-RAG

The selection of **768 dimensions** for DOF-RAG is based on:

* **Storage efficiency**: 25% savings compared to 1024d
* **Preserved quality**: No loss in the system's response capability
* **Scalability**: Sustainable projections for extensive volumes of historical and future content

### Replicable Methodology

This analysis provides a replicable methodological framework for evaluating architecture decisions in RAG systems, based on empirical measurements from real databases with **January 2025 DOF** content (10,090 chunks).

**Databases used:**

* `db_qwen_512.duckdb` - 512 dimension embeddings (January 2025)
* `db_qwen_768.duckdb` - 768 dimension embeddings (January 2025)
* `db_qwen_1024.duckdb` - 1024 dimension embeddings (January 2025)

**Limitations and scalability:** Although the analysis was based on one month of data due to the computational limitations of the embedding generation process, the identified overhead factors are extrapolable to larger volumes, as they represent inherent structural properties of DuckDB.
**Support files and replication:**

* [Main analysis script](https://github.com/CodeandoGuadalajara/dof-rag/blob/embedding-overhead-analysis/overhead_analysis/embedding_overhead_analysis.py) - Complete measurement and calculation algorithm
* [Complete analysis data](https://github.com/CodeandoGuadalajara/dof-rag/blob/embedding-overhead-analysis/overhead_analysis/embedding_overhead_analysis_results.json) - Detailed results in JSON format
* [Database verification script](https://github.com/CodeandoGuadalajara/dof-rag/blob/embedding-overhead-analysis/overhead_analysis/verify_databases.py) - Data consistency validation

**Applicable methodology:** The measurement principles can be applied to any RAG system using DuckDB as a vector database, regardless of the content domain or embedding model used.

Efficient storage combined with rigorous empirical analysis is fundamental for making architectural decisions in production RAG systems.
