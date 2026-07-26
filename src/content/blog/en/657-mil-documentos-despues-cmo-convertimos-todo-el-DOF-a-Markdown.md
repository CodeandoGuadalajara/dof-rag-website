---
title: '657 thousand documents later: how we converted ALL of the DOF to Markdown'
date: 2026-04-20T06:00:00.000Z
author: DOF-RAG Team
description: >-
  From 657,867 .doc files from Mexico's Official Journal of the Federation to
  clean Markdown: tools, results, and what's left to do.
tags:
  - DOF-RAG
  - conversión de documentos
  - Markdown
  - LibreOffice
  - Pandoc
  - catdoc
featured: true
---

# 657 thousand documents later: how we converted ALL of the DOF to Markdown

In the [previous post](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/11/cuatro-pasos-para-domar-el-dof-conversin-limpieza-anlisis-y-estructura/) we described our DOF processing pipeline in four steps. Now let's talk about what it took to convert the **657,867 .doc files** from the Official Journal of the Federation to Markdown: what we used, what we found, and what's next.

## The dataset

657,867 .doc files. January 1999 to April 2026. Twenty-seven years of government documents: laws, decrees, notices, calls for applications, resolutions. All in binary Word format. The source directory weighs **71 GB**.

We needed to convert everything to clean Markdown to generate embeddings and build the RAG system.

## The pipeline

Our `convert_doc_to_md.py` uses a two-step flow:

```
.doc → [LibreOffice headless] → .docx → [pandoc + Lua filter] → .md
```

- **LibreOffice** converts the binary .doc to .docx (modern XML)
- **pandoc** with our custom Lua filter (`dof_headers.lua`) converts the .docx to Markdown, preserving the DOF's heading structure

Configuration: 4 parallel workers, 600-second timeout per file, up to 3 retries.

## Results

| Métrica | Valor |
|---------|-------|
| Archivos procesados | 657,867 |
| Exitosos (LibreOffice + pandoc) | 657,227 (99.90%) |
| Recuperados (catdoc) | 640 |
| Fallidos | 0 |
| Velocidad promedio | ~8 archivos/segundo |
| Tamaño .doc original | 71 GB |
| Tamaño .md + imágenes | 58 GB |
| Imágenes extraídas | 90,370 |

### Verified coverage

We compared our .doc files against the 6,079 complete PDFs per edition we have downloaded (2002-2025):

- All working days with PDFs have corresponding .doc files
- 2 missing dates were identified and downloaded (2002-01-28: +24 docs, 2005-08-09: +181 docs)
- 2 extraordinary weekend editions are scan-only PDFs (no Word versions exist)
- Pre-1999: no Word files exist on the DOF site, only scanned PDFs

## The images

During conversion we discovered that ~1.7% of files (~10,800) had broken image references. Pandoc was run without `--extract-media`, so the .md files said `![](media/imagen.png)` but the images were never extracted.

The fix: add `--extract-media` to the pandoc command and reconvert those files. Result: **90,370 images** correctly extracted (~25 GB additional).

## The files LibreOffice couldn't process

LibreOffice covered 99.90%. The remaining 640 files (mostly AVISOS from the SIDOF system) failed due to timeout or unrecognized format.

We used Linux's `file` command to see what was really behind those .doc extensions, and it turned out not all were the same:

### catdoc — legitimate .doc files

Most were .doc files in OLE format (Word 97-2003). LibreOffice would hang on their size or complexity. **`catdoc`** extracts text directly from the binary format without attempting to render anything:

```bash
catdoc archivo.doc > archivo.md
```

It extracted clean text from all 640 files in less than a second each.

### python-docx — .docx files with .doc extension

Some files had `PK` as their first bytes (ZIP signature), meaning they were .docx (Office 2007+) with a .doc extension. For these we used **`python-docx`**:

```python
from docx import Document

doc = Document("archivo.doc")  # Actually .docx
for paragraph in doc.paragraphs:
    print(paragraph.text)
```

### Summary

| Método | Archivos | Resultado |
|--------|----------|-----------|
| LibreOffice + pandoc | 657,227 | ✅ Exitoso |
| `catdoc` | 640 | ✅ Exitoso |
| `python-docx` | 1 | ✅ Exitoso |
| **Total** | **657,867** | **100% convertido** |

The tradeoff of using `catdoc` and `python-docx` is that they only extract plain text: no images, no heading structure (h1, h2, h3...). The Markdown produced by LibreOffice + pandoc does have title hierarchy and embedded images, which is valuable information for RAG. But having unformatted text is better than having nothing — these 640 files represent less than 0.1% of the total.

## Distribution by year

The DOF doesn't publish the same amount every year:

| Año | Documentos | Observación |
|-----|-----------|-------------|
| 2014 | 31,620 | Peak year |
| 2013 | 30,582 | |
| 2012 | 30,012 | |
| 2011 | 29,623 | |
| 2020 | 16,733 | Lower (pandemic) |
| 2026 | 5,436 | Partial data (Jan-Apr) |

2011-2014 was the period with the most publications. Since then the trend has been declining.

## Distribution by size

There are two types of documents with very different profiles:

**AVISOS** (88% of the total, average 21 KB): edicts, appointments, calls for applications, public tenders. Most are short documents of 1-2 pages.

**DOF documents** (12% of the total, average 265 KB): decrees, laws, regulations, agreements. These include longer documents — 30% are between 10 and 100 KB (several pages) and 30% exceed 100 KB (tens of pages).

| Categoría | Ejemplo | % del total |
|-----------|---------|-------------|
| Tiny (<1 KB) | Cover pages, errata | ~3% |
| Small (1-10 KB) | Notices, edicts | ~71% |
| Medium (10-100 KB) | Regular documents | ~20% |
| Large (100 KB-1 MB) | Extensive decrees, regulations | ~5% |
| Very large (>1 MB) | Tariff schedules, listings | ~1% |

## What this process taught us

1. **Don't depend on a single tool.** LibreOffice covers 99.9%, but that remaining 0.1% will hurt if you don't have a plan B. `catdoc` and `python-docx` as backups made the difference between "almost done" and "100% converted."

2. **Verify the actual format, not the extension.** Just because a file says `.doc` doesn't mean it's .doc. Checking magic bytes (`PK` = ZIP, `ÐÏ` = OLE) saves hours of debugging.

3. **When something fails consistently, change strategy.** Retrying with the same timeout just wastes time. Detecting problematic files and using a different tool was more efficient.

4. **Images matter.** The first run without `--extract-media` left ~10,800 files with broken references. Always verify that outputs contain everything the content references.

5. **Verify against external sources.** Comparing against the complete PDFs allowed us to find 2 missing dates we didn't even know we were missing.

6. **Parallel processing is essential.** At ~8 files/second with 4 workers, conversion took several hours. Sequentially it would have taken days.

## What's next: scanned PDFs

The 657,867 Markdown files are ready, but they're not the entire DOF.

Before 1999 the DOF only existed on paper. The DOF website digitized those editions as scanned PDFs — images of each page, with no extractable text. There are also scanned PDFs for some later periods where no .word files exist.

We've downloaded 6,079 editions in PDF (2002-2025, 102 GB). The 1990-2001 PDFs are still missing — about 12 years, approximately 3,000 more editions. We estimate between **650,000 and 850,000 scanned pages** in total: decades of laws, decrees, and notices that currently exist only as images.

### OCR with vision-language models

VLM-based OCR models have advanced significantly. Recent references like [Daniel van Stren's work](https://danielvanstrien.xyz/posts/2026/re-ocr-collections/) and [LightOn's benchmarks](https://lighton.ai/lighton-blogs/open-source-lightonocr-2-just-outscored-claude-gpt-5-qwen3-mistral-and-mathpix-at-table-extraction) show that models like **LightOnOCR-2** (1B parameters, Apache 2.0) can process scanned documents at ~$0.002 per page with professional quality — even surpassing GPT-5 mini and Claude Sonnet 4.6 in table extraction.

The plan:

1. **Download** the missing PDFs (1990-2001)
2. **Run OCR** with VLM models via Hugging Face Jobs (cloud GPU)
3. **Generate** clean Markdown from scanned images
4. **Integrate** with the 657,867 existing .md files

Estimated cost: **~$800-1,500 USD** for the entire collection. Less than the cost of a coffee per day for a year to digitize decades of Mexico's official record.

Beyond RAG, this has enormous value as documentary heritage. Anyone who has tried searching for a law or decree from the 90s on the DOF site knows the frustration: scanned PDFs that can't be searched, pages you have to browse one by one. Digitizing this is a public service.

That'll be for another post :-p

The conversion code is available in our [GitHub repository](https://github.com/CodeandoGuadalajara/dof-rag).

---

*This post is part of the documentation series for the [DOF-RAG](https://github.com/CodeandoGuadalajara/dof-rag) project, an initiative by [Codeando Guadalajara](https://codeandoguadalajara.github.io/) to make information from the Official Journal of the Federation accessible through artificial intelligence.*
