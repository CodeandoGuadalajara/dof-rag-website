---
title: "DOF Markdown Structure: How Viable Is Heading-Based Chunking?"
description: "Analysis of the structure of 26,607 medium and large DOF documents (2020–2026) to determine the RAG chunking strategy."
date: "2026-05-22"
heroImage: ""
category: "development"
tags: ["dof-rag", "chunking", "markdown", "analysis"]
author: "Joaquín Bravo Contreras"
---

## Context

Before building the chunker for the RAG, we wanted to know: do documents from the Official Journal of the Federation (DOF) have enough structure (headings) for section-based chunking?

We already knew the overall corpus distribution: ~71% are small notices and edicts (< 10 KB) that don’t need chunking. So we focused the analysis on medium and large documents — the ones that would actually benefit from being split into sections.

## The corpus: 26,607 “large” documents (≥ 10 KB)

Of the 131,830 documents from 2020–2026, only 26,607 weigh 10 KB or more:

| Category | Range | Count | % of total |
|-----------|-------|----------|-------------|
| Medium | 10–100 KB | 16,849 | 12.8% |
| Large | 100 KB–1 MB | 8,166 | 6.2% |
| Very large | > 1 MB | 1,592 | 1.2% |

## Result: structure by size

| Pattern | ≥ 10 KB | Medium | Large | Very large |
|--------|---------|----------|---------|-------------|
| Standard H2/H3 | 47.4% | 38.1% | **62.5%** | **69.3%** |
| Bold lines | 49.9% | **57.9%** | 37.3% | 30.4% |
| Plain text | 2.4% | 3.8% | 0.0% | 0.0% |
| Articles / roman numerals / tables | 0.3% | 0.3% | 0.2% | 0.3% |

The trend is clear: **the larger the document, the more likely it is to have H2/H3 headings**. Large documents (62.5%) and very large documents (69.3%) almost always have headings.

Medium documents (10–100 KB) are more divided: 38% have headings, 58% have bold lines. But many of these are tender notices and calls for applications — documents that tend to use bold formatting as visual structure.

## Pattern 1: Standard H2/H3 (47% of the corpus ≥ 10 KB)

The ideal case. Pandoc generated headings correctly. The typical pattern is a composite document (several official documents inside a single DOF file):

**Example:** `2022/11/14112022/MAT/006_DOF_20221114_MAT_5671254.md` (63 KB, 28 headings)

```markdown
# CONSEJO DE LA JUDICATURA FEDERAL

## ACUERDO General 33/2022 del Pleno del Consejo de la Judicatura
Federal, relativo a la conclusión de funciones del Segundo...

### Al margen un sello con el Escudo Nacional, que dice: ...

(Contenido del acuerdo 33/2022)

## ACUERDO General 34/2022 del Pleno del Consejo de la Judicatura
Federal, relativo a la conclusión de funciones de los...

### Al margen un sello con el Escudo Nacional, que dice: ...

(Contenido del acuerdo 34/2022)
```

Each H2 is a distinct document. The H3s are almost always “Al margen un sello con el Escudo Nacional...” — metadata that can be ignored for chunking.

**Example 2:** `2023/11/08112023/VES/001_DOF_20231108_VES_5708044.md` (70 KB, 26 headings)

```markdown
## CONVENIO de Coordinación que celebran la Secretaría de Medio Ambiente...

## AVISO por el que se informa al público en general que está a su
disposición el estudio realizado por la Comisión Nacional...

## AVISO por el que se informa al público en general...
```

Each heading marks an independent document inside the DOF file for that day.

## Pattern 2: Bold lines (50% of the corpus ≥ 10 KB)

Documents that use `**TEXTO**` as visual separators. Pandoc kept them as bold lines instead of converting them into headings.

Most are tender notices, calls for applications, and administrative forms. The typical pattern:

**Example:** `2023/08/08082023/MAT/099_AVISO_20230808_MAT_5697940.md` (10 KB)

```markdown
**FISCALIA GENERAL DE LA REPUBLICA**

OFICIALIA MAYOR

DIRECCION GENERAL DE RECURSOS MATERIALES Y SERVICIOS GENERALES

**LIC. EDUARDO MARTINEZ FRAUSTO**

**(R.- 540204)**

La Fiscalía General de la República, en cumplimiento a lo que
establece el artículo 134 de la Constitución Política...
```

The bold lines are: agency, responsible person’s name, registration number. They are not true content sections — they are header metadata.

At the large-document extreme, the “bold docs” are the annexes of the Resolución Miscelánea Fiscal (30–40 MB of tables):

**Example:** `2024/01/15012024/MAT/001_DOF_20240115_MAT_5714324.md` (39 MB)

```markdown
> PODER EJECUTIVO

SECRETARIA DE HACIENDA Y CREDITO PUBLICO

ANEXO 1-A de la Resolución Miscelánea Fiscal para 2024...

**Trámites Fiscales**

**II. Trámites**

**Ley de Ingresos de la Federación.**
```

Only 4 bold lines in 39 MB — the rest are thousands of tables. Bold-based chunking does not apply here; these would need table-based or size-based chunking.

## Pattern 3: Plain text (2.4%)

No headings or bold lines. These are edicts and judicial notifications. Since they are medium-sized (10–30 KB), fixed-size chunking works well.

## Implications for the chunker

The strategy depends on document size:

| Size | Strategy | Rationale |
|--------|-----------|---------------|
| < 10 KB (74%) | No chunking | A single chunk is enough |
| 10–100 KB (13%) | Headings → bold lines → fixed size | Mixed: 38% headings, 58% bold lines |
| 100 KB–1 MB (6%) | Headings (62% have them) | Most are already structured |
| > 1 MB (1%) | Headings + table fallback | 69% have headings; the rest are giant tables |

For composite documents (several documents in a single file), each H2 is typically an independent document — natural H2-based chunking works well.

## Next Steps

- Implement the hybrid chunker
- Define the maximum chunk size (~1,000 tokens with ~100-token overlap)
- Decide a strategy for very large tables (row-level chunking? LLM summarization?)
