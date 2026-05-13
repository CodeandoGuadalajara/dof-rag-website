---
title: 'Four steps to process the DOF: conversion, cleanup, analysis and structure'
date: 2025-11-19T06:00:00.000Z
author: DOF-RAG Team
description: >-
  From the downloaded WORD file to structured Markdown ready for embeddings: a
  walkthrough of our complete processing pipeline that includes LibreOffice
  conversion, custom LUA filters, Gemini image analysis, and a robust directory
  architecture.
tags:
  - DOF-RAG
  - pipeline
  - Gemini
  - LibreOffice
  - Pandoc
  - Markdown
  - WORD
---

# From chaotic WORD to structured Markdown: the complete pipeline

After [switching our strategy from PDFs to WORD files](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/11/del-pdf-al-word-cuando-el-costo-computacional-dicta-el-cambio-de-estrategia/), we faced a new challenge: converting those WORD files into clean, structured Markdown ready for embedding generation. A simple conversion wasn't enough; we needed to preserve structure, clean up unnecessary styles, extract and analyze images, and organize everything in a scalable way.

The solution was to build a four-step pipeline, each with its own responsibility. This post documents how this workflow processes thousands of government documents daily.

## The pipeline in context: from download to embedding

Before diving into technical details, let's look at the big picture:

```
1. Download WORD files from dof.gob.mx.
2. Convert and unify document editions.
3. Transform documents to Markdown.
4. Analyze images and add descriptions.
   ↓
5. Embedding generation (next phase of the project)
```

## Step 1: Downloading WORD files

**Script:** `get_word_dof.py`\
**Input:** Desired dates and editions\
**Output:** `.doc` files organized by date/edition

We already covered this step in detail in [our previous post](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/11/del-pdf-al-word-cuando-el-costo-computacional-dicta-el-cambio-de-estrategia/), but it's worth mentioning an interesting technical challenge we encountered:

### The mystery of error 204

The DOF website has buttons to download WORD files directly. The problem is that when trying to access these URLs programmatically, the server responds with **HTTP 204 (No Content)** — basically a "yes, I received your request, but I'm not giving you anything."

**Output structure:**

```
dof_word/
└── 2025/
    └── 01/
        └── 02012025/
            ├── MAT/
            │   ├── 001_DOF_20250102_MAT_5736291.doc
            │   └── 002_DOF_20250102_MAT_5736292.doc
            └── VES/
                └── 001_DOF_20250102_VES_5736450.doc
```

## Step 2: DOC → DOCX conversion with LibreOffice

**Script:** `dof_processor.py`\
**Input:** `.doc` files from step 1\
**Output:** Individual `.docx` files + unified documents per edition

This step solves a fundamental problem: `.doc` files (Microsoft's old binary format) are difficult to process directly. We needed to convert them to `.docx` (modern XML format) so we could manipulate them with standard tools.

### Why LibreOffice and not other alternatives?

We evaluated several options:

* **Microsoft Office API**: Requires a license and only works on Windows
* **python-docx**: Cannot read `.doc` files, only `.docx`
* **LibreOffice headless**: **Open source, cross-platform, and robust** ✅

The decision to use LibreOffice was strategic: we wanted a fully open source solution that anyone could replicate without depending on proprietary software.

### Directory architecture: separation of responsibilities

A key principle of our design is to **treat DOC files as a read-only library**. We never modify the downloaded originals:

```
dof_word/          # Read only - original library
└── 2025/01/02012025/MAT/
    └── archivo.doc

dof_docx/          # Processed files - modifiable
└── 2025/01/02012025/MAT/
    ├── archivo.docx
    └── 02012025_MAT.docx  # Unified document
```

This separation has important advantages:

* **Re-processing without re-downloading**: If something fails, we can reprocess without downloading again
* **Safe experimentation**: We can try different conversions without risk
* **Auditing**: We always have the original files for comparison

### The LibreOffice challenge: timeouts

LibreOffice in headless mode is a good tool but temperamental. Some complex documents cause the process to hang indefinitely. Our solution:

```python
# 90-second timeout per file
timeout_seconds = 90

# Execution with timeout control
result = subprocess.run(
    ['soffice', '--headless', '--convert-to', 'docx', ...],
    timeout=timeout_seconds
)
```

If a file exceeds the timeout, we mark it as problematic and continue. The script generates a report at the end:

```
archivos_problematicos_20251119_143022.txt
- archivo_complejo_1.doc (timeout 90s)
- archivo_corrupto_2.doc (conversion error)
```

**Real metrics (measured on 14 files):**

* **Total conversion time**: \~9 seconds for 14 files
* **Average speed**: \<1 second per file
* **Success rate**: \~97% (3% requires manual intervention)
* **Unified documents**: 1 per edition (MAT/VES) per day

## Step 3: DOCX → Markdown with Pandoc

**Script:** `dof_docx_to_md.py`\
**Input:** `.docx` files from step 2\
**Output:** `.md` files with extracted images

This is where the real conversion magic happens. We use **Pandoc**, the Swiss army knife of document conversion, with custom LUA filters to handle the DOF's particularities.

### The Word styles problem

DOF documents use Word styles with specific names to structure content:

* `CABEZA` → Should be H1 in Markdown
* `Titulo 1` → Should be H2
* `Titulo 2` → Should be H3
* `ANOTACION` → Should be H4

Pandoc on its own doesn't know how to map these custom styles. This is where LUA filters come in.

### LUA filters: the style translator

We created `dof_headers.lua`, a filter that intercepts document elements during conversion and transforms them according to specific rules:

```lua
local style_map = {
  ["CABEZA"] = 1,      -- H1
  ["Titulo 1"] = 2,    -- H2
  ["Titulo 2"] = 3,    -- H3
  ["ANOTACION"] = 4,   -- H4
}
```

### Image extraction

Pandoc handles the extraction of embedded images automatically:

```python
pandoc_cmd = [
    'pandoc',
    str(docx_path),
    '--extract-media', str(images_dir),  # Extracts images here
    '--lua-filter', str(lua_filter_headers),
    '-o', str(output_path)
]
```

**Real metrics (measured on 14 files):**

* **Total conversion time**: \~4 seconds for 14 files
* **Average speed**: \<0.5 seconds per file
* **Extracted images**: 55 images in this run
* **Configured timeout**: 300-600 seconds depending on file size

## Step 4: Image analysis with Gemini

**Script:** `dof_image_analyzer.py`\
**Input:** Images extracted from step 3\
**Output:** Updated `.md` files with descriptive alt text

The final pipeline step adds context to images using **Gemini 2.5 Flash-Lite**, Google's AI model.

### Why analyze images?

DOF documents contain tables, charts, diagrams, and official seals in image format. For a RAG (Retrieval Augmented Generation) system, these images are "blind spots" without textual description.

Automated image analysis enables us to:

* **Index visual content**: Embeddings can capture information from tables and charts

**Real metrics (measured on 55 images):**

* **Total time**: 288 seconds (\~4.8 minutes) for 55 images
* **Speed**: \~11 images per minute (with rate limiting)
* **Description accuracy**: High for structured tables and charts
* **Cost**: \~0.40 USD per 1,000,000 output tokens (Gemini 2.5 Flash-Lite public rate)

## The complete flow in action

Let's see how the full pipeline executes to process one day of the DOF:

```bash
# Step 1: Download WORD files from March 15, 2024
uv run get_word_dof.py 15/03/2024 --editions both

# Step 2: Convert DOC to DOCX and unify
uv run dof_processor.py 15/03/2024

# Step 3: Convert DOCX to Markdown
uv run dof_docx_to_md.py 15/03/2024

# Step 4: Analyze images with Gemini
uv run dof_image_analyzer.py 15/03/2024
```

**Real measured times (one full DOF day):**

* Download: 46 seconds (14 files including notices)
* DOC→DOCX conversion: 9 seconds (14 files)
* DOCX→MD conversion: 4 seconds (14 files)
* Image analysis: 288 seconds (\~4.8 minutes, 55 images with rate limiting)

**Total: \~347 seconds (\~5.8 minutes) per DOF day**

## The result...

This Markdown is **ready to be chunked and converted into embeddings** for our RAG system. But that's a story for the next post.

## Open source and replicable

This entire pipeline is available in our GitHub repository. Each script includes detailed documentation in its corresponding README:

* `dof_word/get_word_dof.py` - File downloads
* `dof_processor/dof_processor.py` - DOC→DOCX conversion
* `pandoc_filters/dof_docx_to_md.py` - DOCX→Markdown conversion
* `dof_image_analyzer/dof_image_analyzer.py` - Image analysis

*All tools are open source*

*This article is part of our series on the architecture and processing of the DOF-RAG project. For the complete code and detailed documentation, visit our [GitHub repository](https://github.com/CodeandoGuadalajara/dof-rag).*
