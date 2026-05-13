---
title: 'From PDF to WORD: when computational cost dictates a change of strategy'
date: 2025-11-19T06:00:00.000Z
author: DOF-RAG Team
description: >-
  How the reality of massive document processing led us to rethink our strategy:
  from downloading complete PDFs to obtaining segmented WORD files, dramatically
  reducing computational cost without sacrificing quality.
tags:
  - DOF-RAG
  - web-scraping
  - WORD
  - PDF
---

# When scaling forces you to rethink everything (and that's okay)

There are moments in software development where theory meets reality in a brutal way. One of those moments arrived when we tried to scale our document processing system for Mexico's Official Journal of the Federation. What worked perfectly with a handful of files became a computational nightmare when we faced **decades of daily publications**.

In [our previous analysis](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/06/la-batalla-de-los-convertidores-nuestra-experiencia-extrayendo-texto-del-dof/), we exhaustively evaluated different PDF-to-Markdown converters. We chose Marker as our primary tool for its balance of quality and features. But there was a problem that no code optimization could solve: **the computational cost of processing monumental PDFs simply didn't scale**.

The solution was to completely rethink the source strategy: **stop downloading PDFs and start working with WORD files**.

This is the story of how a seemingly simple change in file format radically transformed our processing pipeline, implemented approximately one month ago and now the foundation of our operation.

## The problem: PDFs and the computational cost monster

### The original flow: simple but unsustainable

Our first approach was straightforward and seemingly elegant:

1. Download complete DOF PDFs from `diariooficial.gob.mx`
2. Process each PDF (50-200 MB files each)
3. Convert to Markdown using specialized tools
4. Extract structured text for embeddings

**The original script (`get_dof.py`):**

```python
def get_url(year, month, day):
    """Generate the URL for a given date"""
    base_url = "https://diariooficial.gob.mx/abrirPDF.php?archivo="
    return f"{base_url}{day}{month}{year}-MAT.pdf&anio={year}&repo=repositorio/"
```

Simple, right? One endpoint, one file, done.

### The reality of scaling

When we started processing years of publications, the numbers stopped being friendly:

* **Computational cost:** Each PDF required intensive processing
* **Conversion time:** Marker took \~22 minutes for a 402-page document, Docling \~39 minutes — times that became prohibitive at scale
* **Memory resources:** Complete PDFs consumed considerable RAM during processing
* **Error rate:** Complex documents caused frequent conversion failures

Doing the math was depressing: **processing decades of DOFs with this approach would require weeks of continuous computing** and infrastructure costs that were not viable for a public good project.

## The tools that didn't scale

In our previous analysis of PDF-to-Markdown converters, we exhaustively evaluated different tools. The results were revealing: all worked well for individual cases, but when scaling to thousands of documents, the story changed radically.

Recapping the most relevant findings:

### 🔧 Marker

**Promise:** Precise conversion with structure recognition\
**Reality:** Notable quality (8.5/10), but **1340 seconds (\~22 minutes)** for a 402-page document. With image extraction at 90% accuracy and good table handling, it was our preferred option. However, multiplied by thousands of documents, the computational cost became unsustainable.

### 🔧 Docling

**Promise:** Robust handling of complex documents\
**Reality:** **2338 seconds (\~39 minutes)** for the same 402-page document. Similar quality to Marker (8/10), but without image extraction and with even more prohibitive times for bulk processing.

### 🔧 Other tools evaluated

We also tested **PyMuPDF** (extremely fast at 6 seconds, but with nearly unusable quality at 2/10), **pymupdf4llm** (77 seconds with 8/10 quality but no image extraction), and even **Gemini** integrations that tripled the time without proportional quality improvements.

**The pattern was clear:** all these tools were excellent for specific use cases, but none was designed to efficiently process thousands of complex government documents.

It wasn't the tools' fault. It was our fault for trying to use a precision hammer to demolish a building.

> 💡 **For the full analysis** with comparison tables, detailed metrics, and evaluation of each tool, see our previous post: [The battle of the converters](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/06/la-batalla-de-los-convertidores-nuestra-experiencia-extrayendo-texto-del-dof/).

## The discovery: WORD as an unexpected lifeline

The revelation came when we explored the DOF's infrastructure more deeply. It turns out the Mexican government doesn't just publish the monumental PDFs — they also offer **individual WORD files for each section of the journal**.

### The DOF's hidden architecture

The DOF has two main sites:

**1. dof.gob.mx** - The main site with complete documents per section:

```python
# URL structure for WORD files
url = f"https://www.dof.gob.mx/nota_to_doc.php?codnota={codnota}"
```

**2. sidof.segob.gob.mx** - Digital system with segmented notices (AVISOS):

```python
# AVISOS separated by note
url = f"https://sidof.segob.gob.mx/notas/getDoc/{note_id}"
```

Each day's publication is **pre-segmented into individual WORD documents** by topic and section. Instead of a monolithic 150 MB PDF, we could download 50 WORD files of 500 KB each.

**The advantages were evident:**

* ✅ Smaller, more manageable files
* ✅ Already segmented by topic (no need to detect sections)
* ✅ WORD format easier to process into Markdown
* ✅ Lower computational cost per document
* ✅ Trivial parallelization of processing

## The new architecture: intelligent web scraping

### The technical challenge: structured scraping

The problem is that these WORD files aren't listed in a simple directory. They must be extracted through web scraping of the DOF's HTML pages.

**The new script (`get_word_dof.py`) implements:**

#### 1. WORD link extraction from the main DOF site

```python
def extract_word_links(html_content: str, base_url: str) -> List[tuple[str, str]]:
    """
    Extracts WORD file links from HTML content
    Returns: List of tuples (url_word, codnota)
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    word_anchors = soup.find_all('a', href=re.compile(r'/nota_to_doc\.php\?codnota=\d+'))
    
    for anchor in word_anchors:
        href = anchor.get('href')
        if href:
            match = re.search(r'codnota=(\d+)', href)
            if match:
                codnota = match.group(1)
                full_url = urljoin(base_url, href)
                word_links.append((full_url, codnota))
    
    return word_links
```

#### 2. AVISOS extraction from SIDOF

An additional (and minor) feature of the new system is that it also downloads the AVISOS (notices) that were included in the PDF but are separated in WORD format:

```python
def extract_notice_links(html_content: str) -> List[tuple[str, str]]:
    """
    Extracts notice links from SIDOF for AVISOS sections
    Detects edition (MAT/VES) based on tab-pane container
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    avisos_spans = soup.find_all('span', class_='txt-traduct', 
                                 string=re.compile(r'^\s*AVISOS\s*$'))
    
    for avisos_span in avisos_spans:
        tab_pane = avisos_span.find_parent('div', class_='tab-pane')
        # Detects MAT/VES edition by tab-pane
        # ... extracts note links
```

This additional segmentation is a side effect of the WORD architecture, not the main reason for the change. We simply discovered that the content was already naturally separated.

#### 3. Structured naming and organization

The new system generates a much more organized folder structure:

```
dof_word/
├── 2025/
│   ├── 01/
│   │   ├── 02012025/
│   │   │   ├── MAT/
│   │   │   │   ├── 001_DOF_20250102_MAT_5736291.doc
│   │   │   │   ├── 002_DOF_20250102_MAT_5736292.doc
│   │   │   │   ├── 003_AVISO_20250102_MAT_8472634.doc
│   │   │   └── VES/
│   │   │       ├── 001_DOF_20250102_VES_5736450.doc
```

## Technical details: the devil is in the details

### Download speed control

To be good digital citizens and not overwhelm government servers:

```python
@typer.Option(1.0, help="Wait time in seconds between downloads")
sleep_delay: float

# Usage:
python get_word_dof.py 02/01/2023 --sleep-delay 1.5
```

This parameter allows adjusting the aggressiveness of downloads based on server capabilities.

### Date range support

```python
# Single date
python get_word_dof.py 02/01/2023

# Date range
python get_word_dof.py 01/01/2023 31/01/2023

# Specific editions
python get_word_dof.py 02/01/2023 --editions mat    # Morning only
python get_word_dof.py 02/01/2023 --editions ves    # Afternoon only
python get_word_dof.py 02/01/2023 --editions both   # Both
```

This flexibility enables incremental downloads and daily updates without reprocessing the entire historical archive.

## The results: numbers that speak

**Since implementing the new flow one month ago, the results are overwhelming:**

### Before (PDF flow)

* ⏱️ **Processing time:** 20-40 minutes per complete DOF PDF (some 400+ pages)
* 💾 **Temporary storage:** 150-300 MB per file
* 🔥 **CPU usage:** 80-95% during conversion
* ❌ **Failure rate:** \~15% (complex documents)
* 🔄 **Re-processing:** Difficult (entire file)

### Now (WORD flow)

* ⏱️ **Processing time:** 2-5 minutes per publication day (30-80 small files processed sequentially)
* 💾 **Temporary storage:** 20-50 MB per day (total files)
* 🔥 **CPU usage:** 30-45% (with potential for parallelization)
* ✅ **Failure rate:** \~3% (isolated individual files)
* 🔄 **Re-processing:** Trivial (only problematic files)

**Processing time reduction: \~85-90%**
**Computational cost reduction: \~70-80%**

## Lessons learned: wisdom from the battlefield

## The road ahead: WORD to Markdown

The switch to WORD files solved the data **acquisition** problem, but introduced a new challenge: **WORD to Markdown conversion**.

### The evolution of our processing strategy

1. **[June 2025](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/06/la-batalla-de-los-convertidores-nuestra-experiencia-extrayendo-texto-del-dof/exto-del-DOF):** We evaluated PDF-to-Markdown converters and chose Marker
2. **October 2025 (this post):** We discovered segmented WORD files and changed our acquisition strategy
3. **Next installment:** Efficient WORD to Markdown conversion

In our next blog post we'll dive deeper into:

* WORD format manipulation technologies (.doc and .docx)
* Structure extraction and formatting strategies
* Preservation of tables, lists, and complex elements
* Efficient conversion to clean, structured Markdown
* Comparison: is WORD really easier to process than PDF?

## Conclusions: when changing is evolving

This switch from PDFs to WORD wasn't planned from the start. After meticulously evaluating different PDF-to-Markdown converters and choosing Marker as our best option, we discovered that the real problem wasn't *how* we processed PDFs, but *why* we were processing PDFs in the first place.

It was a **necessary evolution** dictated by the reality of scaling. And that's a common pattern in real-world data projects: **the theoretically perfect architecture often yields to the practically viable one**.

**Is the WORD format perfect?** No.
**Is it better than PDFs for our use case?** Absolutely.
**Will we switch again in the future if we find something better?** Without a doubt.

*This article is part of our series on the architectural decisions and technical challenges of the DOF-RAG project. For full technical details, source code, and documentation, visit our [GitHub repository](https://github.com/CodeandoGuadalajara/dof-rag).*
