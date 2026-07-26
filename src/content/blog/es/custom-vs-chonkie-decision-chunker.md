---
title: "Custom vs Chonkie: por qué construimos nuestro propio chunker para el DOF"
description: "Evaluamos 8 estrategias de chunking (5 de Chonkie, 2 pipelines, 1 custom) sobre 1,000 documentos del DOF. Ninguna opción de librería estándar respetaba tanto la estructura del documento como el límite de tokens."
date: "2026-07-26"
heroImage: ""
category: "desarrollo"
tags: ["dof-rag", "chunking", "chonkie", "benchmark", "decision"]
author: "Joaquín Bravo Contreras"
---

## El punto de partida: usar una librería estándar

Cuando empezamos el RAG, lo razonable era usar [Chonkie](https://github.com/chonkie-inc/chonkie), una librería especializada en chunking con 11 chunkers, pipeline API, y 33x más rápida que LangChain. ¿Para qué reinventar la rueda?

Pero el DOF tiene estructuras que ningún chunker genérico entiende:

- **Documentos compuestos** con múltiples decretos separados por H2
- **Tablas gigantes** de Resoluciones Misceláneas Fiscales (40 MB)
- **Avisos de licitación** que usan negritas como metadato visual
- **Edictos judiciales** sin headings ni estructura

Decidimos construir un benchmark comparando nuestro chunker custom contra las opciones de Chonkie. Este post cuenta qué encontramos en cada opción, los fixes que tuvimos que hacer, y por qué al final el custom ganó.

## El benchmark

Muestra: **1,000 archivos** aleatorios de `./dof_md` (2020-2026), seed fija 42.
Límite: **800 tokens** por chunk, contados con el tokenizer real de [`pplx-embed-context-v1-0.6b`](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b).
Métricas: número de chunks, mediana/máximo de tokens, % de archivos con chunks oversized (> 880 tokens), velocidad.

## Opción 1: Chonkie RecursiveChunker (markdown)

La opción por defecto. Aplica una jerarquía de delimitadores markdown: párrafos → líneas → frases → palabras.

```python
from chonkie import RecursiveChunker
chunker = RecursiveChunker(
    tokenizer=PPLXTokenizer(),
    chunk_size=800,
    rules=RecursiveRules.from_recipe("markdown"),
)
```

**Resultado:** 7,157 chunks, mediana 707 tokens, máx 800, 0% oversized.

Es estable y rápido (20s). Pero no entiende que un H2 en el DOF es un documento independiente. Parte decretos completos en pedazos arbitrarios.

**Ejemplo de chunk roto:**

```markdown
## DECRETO por el que se reforman los artículos 4o. y 5o. de la Ley...

Artículo Primero...

---

## DECRETO por el que se reforma el artículo 7o. de la Ley...
```

El RecursiveChunker puede partir justo en `---`, separando el título del decreto de su contenido.

## Opción 2: Chonkie RecursiveChunker con H2 como delimitador primario

Intentamos hacerlo más comparable al custom usando H2 como primer nivel:

```python
rules = RecursiveRules(levels=[
    RecursiveLevel(delimiters=["\n## "]),
    RecursiveLevel(delimiters=["\n### "]),
    RecursiveLevel(delimiters=["\n\n"]),
    RecursiveLevel(delimiters=[". ", "! ", "? "]),
])
```

**Resultado:** 7,028 chunks, mediana 702 tokens, máx **7,895**, **4.7% oversized**.

El problema: cuando una sección H2 es un párrafo o tabla gigante sin sub-delimitadores, Chonkie no la parte. Un H2 de 7,895 tokens se queda entero como un solo chunk, excediendo el límite del modelo.

**Ejemplo de chunk oversized:**

Un H2 con una tabla de 5,000 tokens sin H3 ni párrafos dobles dentro. El RecursiveChunker no encuentra dónde cortar y lo deja entero.

## Opción 3: Chonkie TableChunker

Diseñado para documentos dominados por tablas. Detecta tablas y repite el header en cada chunk.

```python
from chonkie import TableChunker
chunker = TableChunker(tokenizer=PPLXTokenizer(), chunk_size=800)
```

**Resultado:** 13,856 chunks, mediana **3,634 tokens**, máx **102,786**, **26.8% oversized**.

Es el peor resultado. TableChunker **no respeta el límite de tokens** en tablas grandes. Una Resolución Miscelánea Fiscal de 100K tokens se queda como un solo chunk gigante.

**Ejemplo de chunk oversized:**

```markdown
| **No. parte** | **Descripción** | **Monto** |
|---------------|-----------------|-----------|
| 1 | Material de oficina | 294,000 |
| 2 | Formas impresas | 134,778 |
... (miles de filas más) ...
```

El chunk contiene la tabla completa de 100K tokens. Inmanejable para recuperación.

## Opción 4: Chonkie TokenChunker

Ventanas fijas de tokens con overlap integrado.

```python
from chonkie import TokenChunker
chunker = TokenChunker(tokenizer=PPLXTokenizer(), chunk_size=800, chunk_overlap=50)
```

**Resultado:** 6,132 chunks, mediana **800**, máx 800, 0% oversized. El más rápido (10.3s).

Perfecto para límites estrictos, pero **ignora completamente la estructura del documento**. Corta a los 800 tokens aunque sea en medio de una tabla, un párrafo, o una frase.

**Ejemplo de chunk roto:**

```markdown
...artículo 5o. de la Ley Federal de

---
(chunk 2)
Protección al Consumidor...
```

La frase se parte en dos. Para recuperación, el contexto se pierde.

## Opción 5: Chonkie SentenceChunker

Corta por frases, con overlap integrado.

```python
from chonkie import SentenceChunker
chunker = SentenceChunker(tokenizer=PPLXTokenizer(), chunk_size=800, chunk_overlap=50)
```

**Resultado:** 6,273 chunks, mediana 765, máx **2,997**, **0.7% oversized**.

Mejor que TokenChunker porque respeta frases, pero algunas "frases" muy largas (o filas de tabla tratadas como frase) exceden el límite.

## Opción 6: Pipeline TableChunker → RecursiveChunker

Chonkie permite encadenar chunkers en un Pipeline. Probamos primero TableChunker (para separar tablas) y luego RecursiveChunker (para partir cada sección):

```python
pipeline = (
    Pipeline()
    .chunk_with("table", chunk_size=1600, tokenizer=tokenizer)
    .chunk_with("recursive", chunk_size=800, tokenizer=tokenizer)
)
```

**Resultado:** **98,576 chunks**, mediana 737, máx 800, 0% oversized.

El pipeline explota el número de chunks. TableChunker divide en cada límite de tabla (incluso tablas pequeñas de 3-4 filas), y luego RecursiveChunker vuelve a partir cada fragmento. Algunos archivos `giant_table` generan hasta **6,566 chunks** cada uno.

No es usable.

## Opción 7: Pipeline RecursiveChunker → TableChunker (al revés)

El usuario sugirió probar al revés: RecursiveChunker primero, y TableChunker solo sobre los fragmentos que contengan tablas.

```python
pipeline = (
    Pipeline()
    .chunk_with("recursive", chunk_size=800, tokenizer=tokenizer)
    .chunk_with("table", chunk_size=800, tokenizer=tokenizer)
)
```

**Resultado:** **6,070 chunks**, mediana **761**, máx 800, 0% oversized. Segundo más rápido (14.8s).

¡Mucho mejor! Es el mejor resultado de Chonkie. Pero hay un problema: **RecursiveChunker no respeta los límites de tabla**. Parte tablas en medio, y luego TableChunker solo recibe fragmentos incompletos.

**Ejemplo de tabla rota:**

```markdown
(chunk 0, 787 tokens)
**INSTITUTO DE SEGURIDAD...**

| **No. de licitación** | ... |
+-----------------------+-----+

(chunk 1, 309 tokens)
| 00637031-027-99 | ... | 1/03/99 |
+-----------------------+-----+
```

La tabla se parte en dos. El header de columnas queda en chunk 0, los datos en chunk 1. Para recuperación, el contexto de la tabla se pierde.

## Opción 8: Custom chunker (nuestro)

El chunker custom clasifica el documento primero y aplica una estrategia específica:

| Patrón | Trigger | Estrategia |
|---|---|---|
| `small` | < 6 KB | Un solo chunk |
| `h2_compound` | ≥2 H2 | Cada H2 es un documento; se mantiene entero hasta 880 tokens |
| `bold_headers` | ≥2 negritas | Split por párrafos |
| `plain_text` | Sin estructura | Split por párrafos |
| `giant_table` | >40% líneas son tablas | Split por filas, repite header de columnas, preserva texto no-tabla |

**Resultado:** 7,735 chunks, mediana **706**, máx **879**, 0% oversized.

Pero llegar aquí no fue directo. Tuvimos que hacer varios fixes.

### Fix 1: El bug de los separadores `+`

El mayor bug que encontramos. Las tablas generadas por [`marker-pdf`](https://github.com/datalab-to/marker) usan separadores que empiezan con `+`, no con `|`:

```markdown
|:------------------:|:-------:|
| **No. partida**    | ...     |
+--------------------+------------------+
| 1                  | ...     |
+--------------------+------------------+
```

La primera versión del splitter `giant_table` solo reconocía `|` como línea de tabla. Cada separador `+` se interpretaba como texto normal y **volcaba el buffer** después de cada fila.

**Resultado antes del fix:** 26,634 chunks, mediana **36 tokens** (una fila por chunk).
**Resultado después del fix:** 7,735 chunks, mediana **706 tokens**.

El fix fue simple pero crítico:

```python
def _is_table_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if stripped.startswith("|"):
        return True
    if stripped.startswith("+") and not stripped.startswith("+ "):
        return True
    return False
```

### Fix 2: H2_MAX_TOKENS

Los documentos compuestos (H2) a veces tienen secciones que son decretos/resoluciones completas. Partirlas a los 800 tokens destruye la coherencia documental.

Primero probamos `H2_MAX_TOKENS = 1_500`: los H2 se mantienen enteros hasta 1,500 tokens. Esto produjo 1.5% de archivos con chunks oversized (entre 880 y 1,500 tokens).

Decidimos ser más estrictos: `H2_MAX_TOKENS = 880` (umbral de tolerancia). Ahora 0% oversized, y solo 2 H2s en la muestra se benefician de mantenerse enteros entre 800 y 880 tokens.

### Fix 3: Preservar texto no-tabla en giant_table

La primera versión de `giant_table` descartaba todo el texto que no fuera tabla (introducciones, notas, firmas). Ahora alterna entre dos buffers:

```python
for line in text.splitlines():
    if _is_table_line(line):
        _flush_text_buffer()
        table_buffer.append(line)
    elif line.strip():
        _flush_table_buffer()
        text_buffer.append(line)
    else:
        text_buffer.append(line)  # línea vacía no flushea tabla
```

Resultado: un documento de 760 KB con 88% de líneas de tabla produce **41 chunks de tabla + 27 chunks de texto**, en lugar de perder todo el contexto.

## Comparación final

| Chunker | Chunks | Mediana | Max | Oversized | Tiempo | ¿Estructura? |
|---|---|---|---|---|---|---|
| **Custom** | 7,735 | 706 | 879 | **0%** | 26s | ✅ Sí |
| Chonkie Pipeline Rev | 6,070 | 761 | 800 | 0% | 15s | ⚠️ Tablas rotas |
| Chonkie Token | 6,132 | 800 | 800 | 0% | 10s | ❌ No |
| Chonkie Sentence | 6,273 | 765 | 2,997 | 0.7% | 18s | ⚠️ Frases |
| Chonkie Recursive | 7,157 | 707 | 800 | 0% | 20s | ⚠️ Genérica |
| Chonkie H2 | 7,028 | 702 | 7,895 | 4.7% | 26s | ⚠️ H2s oversized |
| Chonkie Table | 13,856 | 3,634 | 102,786 | 26.8% | 18s | ❌ Tablas gigantes |
| Chonkie Pipeline | 98,576 | 737 | 800 | 0% | 27s | ❌ Demasiados chunks |

## Por qué ganó el custom

1. **Respeta la estructura del DOF**: H2s enteros, tablas con header repetido, negritas como metadato.
2. **0% oversized**: cumple el límite de tokens sin excepciones.
3. **Mediana óptima**: 706 tokens es un buen balance entre granularidad y contexto.
4. **Late chunking compatible**: los chunks de un mismo documento se concatenan para embeddings contextuales.

## Lecciones aprendidas

1. **Las librerías estándar no conocen tu dominio**. Chonkie es excelente para markdown genérico, pero el DOF tiene patrones específicos (documentos compuestos, tablas gigantes, negritas como metadato) que requieren lógica especializada.

2. **El tokenizer real importa**. Usar el tokenizer de [`pplx-embed-context-v1`](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b) en lugar de una heurística cambió completamente los resultados. Los "tokens" de caracteres no son los mismos que los tokens del modelo.

3. **Los bugs de formato son sutiles pero críticos**. El separador `+` vs `|` en tablas parecía un detalle menor, pero causó una diferencia de 3.4x en el número de chunks.

4. **El orden del pipeline importa**. Table→Recursive explota los chunks; Recursive→Table es mucho mejor pero aún rompe tablas. La mejor estrategia es clasificar primero y aplicar la estrategia correcta por patrón.

## Código y benchmarks

- Chunker custom: [`rag_poc/chunker.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/chunker-dof-patterns/rag_poc/chunker.py) (PR [#55](https://github.com/CodeandoGuadalajara/dof-rag/pull/55))
- Benchmark comparativo: [`scripts/compare_chunkers.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/chonkie-chunker-comparison/scripts/compare_chunkers.py) (PR [#56](https://github.com/CodeandoGuadalajara/dof-rag/pull/56))
- Reporte completo: [`reports/chunker_comparison.md`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/chonkie-chunker-comparison/reports/chunker_comparison.md)
- Sweep de tamaños: [`scripts/sweep_chunk_size.py`](https://github.com/CodeandoGuadalajara/dof-rag/blob/feat/chonkie-chunker-comparison/scripts/sweep_chunk_size.py)

## Siguientes pasos

- PR [#57](https://github.com/CodeandoGuadalajara/dof-rag/pull/57): Local ONNX embedding ([`pplx-embed-context-v1-0.6b`](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b)) con late chunking
- PR [#58](https://github.com/CodeandoGuadalajara/dof-rag/pull/58): SQLite + sqlite-vec + FTS5 database layer
- PR [#59](https://github.com/CodeandoGuadalajara/dof-rag/pull/59): Hybrid search (vector + FTS5 con RRF) y CLI
