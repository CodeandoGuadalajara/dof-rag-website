---
title: "Chunker por patrón: clasificando 131,000 documentos del DOF antes de dividirlos"
description: "Presentamos el chunker del RAG: un clasificador que detecta 5 patrones estructurales en los markdown del DOF antes de aplicar la estrategia de split correcta."
pubDate: "2026-05-23"
heroImage: ""
category: "desarrollo"
tags: ["dof-rag", "chunking", "rag", "pplx-embed", "sqlite-vec"]
author: "Joaquín Bravo Contreras"
---

## El problema: un chunker genérico no entiende el DOF

Los chunkers genéricos (como `MarkdownSplitter` o `RecursiveCharacterTextSplitter`) aplican la misma heurística a todos los documentos. Pero el DOF tiene estructuras muy distintas:

- **Documentos compuestos** con múltiples decretos/acuerdos en un solo archivo, separados por H2
- **Avisos de licitación** que usan negritas como metadato visual, no como secciones
- **Resoluciones Misceláneas Fiscales** de 40 MB que son casi puro markdown tabla
- **Edictos judiciales** de 15 KB sin headings ni negritas
- **Avisos pequeños** de 2 KB que no necesitan chunking

Aplicar el mismo splitter a todos produce chunks de calidad muy desigual. Algunos documentos se parten en pedazos que pierden contexto; otros generan chunks gigantes que exceden el límite de tokens del modelo.

## La solución: clasificar primero, dividir después

El chunker detecta el patrón estructural del documento **antes** de dividir, y aplica una estrategia específica para cada caso:

| Patrón | Trigger | Estrategia |
|---|---|---|
| `small` | < 10 KB | Un solo chunk — el documento completo cabe en el contexto |
| `h2_compound` | ≥2 H2 headings | Cada H2 es un documento independiente; si excede el límite, parte por H3 |
| `bold_headers` | ≥2 líneas en negritas | Las negritas son metadato de encabezado, no boundaries; split por párrafos |
| `plain_text` | Sin headings ni negritas | Split por párrafos dobles con overlap |
| `giant_table` | >40% líneas son tablas markdown | Cada tabla es un chunk; se repite el header de columnas; el texto no-tabla se preserva |

## Resultados: 1,000 documentos de 2020

Corrimos el chunker sobre una muestra aleatoria de 1,000 archivos del directorio `2020/`:

| Patrón | Documentos | % |
|---|---|---|
| small | 719 | 71.9% |
| giant_table | 156 | 15.6% |
| bold_headers | 68 | 6.8% |
| h2_compound | 46 | 4.6% |
| plain_text | 11 | 1.1% |

**La gran mayoría de documentos (72%) son pequeños** — un solo chunk basta. Los documentos grandes (15.6%) son dominados por tablas, lo que confirma que el chunking de tablas es crítico para el corpus.

### Chunks por documento

| Patrón | Promedio | Mediana | Máximo |
|---|---|---|---|
| small | 1.0 | 1 | 1 |
| h2_compound | 98.9 | 82.5 | 454 |
| bold_headers | 23.0 | 9.0 | 251 |
| giant_table | 1,229.8 | 114.0 | 48,977 |
| plain_text | 76.2 | 8.0 | 677 |

Los documentos `giant_table` generan muchos chunks porque las tablas se parten fila por fila (con el header de columnas repetido). El caso extremo de 48,977 chunks corresponde a una Resolución Miscelánea Fiscal de ~12 MB.

### Tokens por chunk

| Patrón | Promedio | Mediana | Máximo |
|---|---|---|---|
| small | 854 | 708 | 2,989 |
| h2_compound | 685 | 810 | 1,476 |
| bold_headers | 726 | 748 | 1,590 |
| plain_text | 781 | 794 | 1,424 |
| giant_table | 59 | 18 | 5,569 |

El límite configurado es `MAX_TOKENS = 800`. Los patrones `h2_compound`, `bold_headers` y `plain_text` respetan el límite. Los `small` ocasionalmente lo exceden (documentos de 9-10 KB que el clasificador deja como `small`). El outlier de 5,569 tokens en `giant_table` proviene de filas de tabla extremadamente largas que no caben en el límite; esto se mitigará cuando reemplacemos el contador heurístico por el tokenizer real.

## Cómo funciona el chunker

### El clasificador

```python
def classify(text: str, size_bytes: int) -> DocPattern:
    if size_bytes < 10_000:
        return DocPattern.SMALL
    
    # ¿Más del 40% de las líneas son tablas?
    lines = text.splitlines()
    non_empty = [ln for ln in lines if ln.strip()]
    table_lines = sum(1 for ln in non_empty if ln.strip().startswith("|"))
    if non_empty and table_lines / len(non_empty) > 0.40:
        return DocPattern.GIANT_TABLE
    
    if size_bytes > 1_000_000:
        return DocPattern.GIANT_TABLE
    
    if len(H2_RE.findall(text)) >= 2:
        return DocPattern.H2_COMPOUND
    if len(BOLD_RE.findall(text)) >= 2:
        return DocPattern.BOLD_HEADERS
    return DocPattern.PLAIN_TEXT
```

La clasificación es rápida: solo cuenta headings, negritas y líneas de tabla. No tokeniza el texto completo.

### Late chunking contextual

El modelo de embeddings (`pplx-embed-context-v1`) es **contextual**: los chunks de un mismo documento deben verse juntos para que el modelo infiera relaciones entre ellos. El chunker no solo produce chunks individuales; el pipeline de indexación los concatena con `SEP` tokens:

```
[chunk1] [SEP] [chunk2] [SEP] [chunk3]
```

Después de la inferencia ONNX, se hace **late chunking**: se localizan los tokens `SEP` en el output y se mean-pool cada segmento para obtener el embedding de cada chunk. Esto es más preciso que embedder cada chunk independientemente.

### Preservación de texto no-tabla

La primera versión del chunker `giant_table` descartaba todo el texto que no fuera tabla (introducciones, notas, pies de página). La versión actual alterna entre dos buffers:

```python
for line in text.splitlines():
    if line.startswith("|"):
        _flush_text_buffer()   # guarda párrafos acumulados
        table_buffer.append(line)
    else:
        _flush_table_buffer()  # guarda tabla acumulada
        text_buffer.append(line)
```

Resultado: un documento de 760 KB con 88% de líneas de tabla produce **41 chunks de tabla + 27 chunks de texto**, en lugar de perder todo el contexto textual.

## Fixes aplicados tras revisión de Copilot

| # | Problema | Fix |
|---|---|---|
| 1 | `GIANT_TABLE` descartaba texto no-tabla | Ahora se alternan `table_buffer` y `text_buffer`; ambos se empaquetan en chunks |
| 2 | `_split_by_heading` crasheaba con heading sin newline final | `text.index("\n", pos)` → `text.find("\n", pos)` con fallback a `len(text)` |
| 3 | H2 sin H3 sub-headings inyectaba `### ` vacío | Se detecta `_split_by_heading` devolviendo una sola tupla con heading vacío; se parte directo sin H3 |
| 4 | `_count_tokens` heurístico subestimaba tablas | Ahora lazy-carga el tokenizer real (`pplx-embed-context-v1-0.6b`) vía `transformers` |

## El contador de tokens

El contador más preciso es el del modelo mismo:

```python
_tokenizer = None

def _count_tokens(text: str) -> int:
    global _tokenizer
    if _tokenizer is None:
        from transformers import AutoTokenizer
        _tokenizer = AutoTokenizer.from_pretrained(
            "perplexity-ai/pplx-embed-context-v1-0.6b",
            trust_remote_code=True,
        )
    return len(_tokenizer.encode(text, add_special_tokens=False))
```

Si `transformers` no está disponible, cae a `len(text) // 3` (heurística conservadora). La primera llamada descarga el tokenizer (~2 MB); las siguientes usan la instancia cacheada.

## Limitaciones conocidas

1. **Límite de tokens del modelo**: El tokenizer de `pplx-embed-context-v1` tiene un límite de 32K tokens. Si un documento produce chunks que concatenados exceden ese límite, el pipeline de indexación los divide en sub-grupos que cada uno lleva un front matter (H1 + H2 del documento) para preservar contexto.

2. **Fuerza bruta en sqlite-vec**: El vector search actual es KNN exacto (L2 distance). Para >100K chunks esto se volverá lento. La alternativa es particionar por metadata (año, dependencia) o migrar a índices aproximados.

3. **Imágenes**: `IMAGE_DESCRIPTION` HTML comments se inlinean como texto, pero las imágenes sin caption (fórmulas matemáticas pequeñas, logos) no generan descripción. El pipeline de VLM (`enrich_markdown_images.py`) captura la mayoría.

## Código

El chunker está en `rag_poc/chunker.py` (PR #55). Se usa así:

```python
from pathlib import Path
from rag_poc.chunker import split_file

chunks = split_file(Path("./dof_md/2020/01/15012020/MAT/001_DOF_20200115_MAT_5583902.md"))
for ch in chunks:
    print(ch.heading_path, ch.chunk_index, ch.pattern.value)
```

## Siguientes pasos

- PR #56: Local ONNX embedding (`pplx-embed-context-v1-0.6b`) con late chunking
- PR #57: SQLite + sqlite-vec + FTS5 database layer
- PR #58: Hybrid search (vector + FTS5 con RRF) y CLI
