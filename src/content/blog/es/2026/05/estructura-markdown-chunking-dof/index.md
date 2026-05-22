---
title: "Estructura del markdown DOF: qué tan viable es el chunking por headings"
description: "Análisis de la estructura de 26,607 documentos medianos y grandes del DOF (2020-2026) para determinar la estrategia de chunking del RAG."
pubDate: "2026-05-22"
heroImage: ""
category: "desarrollo"
tags: ["dof-rag", "chunking", "markdown", "análisis"]
author: "Joaquín Bravo Contreras"
---

## Contexto

Antes de construir el chunker para el RAG, queríamos saber: ¿los documentos del DOF tienen suficiente estructura (headings) para un chunking por secciones?

Ya sabíamos la distribución general del corpus: ~71% son avisos y edictos pequeños (< 10 KB) que no necesitan chunking. Así que enfocamos el análisis en los documentos medianos y grandes — los que realmente se beneficiarían de partirse en secciones.

## El corpus: 26,607 documentos "grandes" (≥ 10 KB)

De los 131,830 documentos de 2020-2026, solo 26,607 pesan 10 KB o más:

| Categoría | Rango | Cantidad | % del total |
|-----------|-------|----------|-------------|
| Medianos | 10-100 KB | 16,849 | 12.8% |
| Grandes | 100 KB-1 MB | 8,166 | 6.2% |
| Muy grandes | > 1 MB | 1,592 | 1.2% |

## Resultado: estructura por tamaño

| Patrón | ≥ 10 KB | Medianos | Grandes | Muy grandes |
|--------|---------|----------|---------|-------------|
| H2/H3 estándar | 47.4% | 38.1% | **62.5%** | **69.3%** |
| Líneas en **negritas** | 49.9% | **57.9%** | 37.3% | 30.4% |
| Texto plano | 2.4% | 3.8% | 0.0% | 0.0% |
| Artículos / romanos / tablas | 0.3% | 0.3% | 0.2% | 0.3% |

La tendencia es clara: **mientras más grande el documento, más probable que tenga H2/H3**. Los documentos grandes (62.5%) y muy grandes (69.3%) casi siempre tienen headings.

Los medianos (10-100 KB) están más divididos: 38% con headings, 58% con negritas. Pero muchos de estos son avisos de licitaciones y convocatorias — documentos que tienden a usar negritas como formato visual.

## Patrón 1: H2/H3 estándar (47% del corpus ≥ 10 KB)

El caso ideal. Pandoc generó headings correctamente. El patrón típico es un documento compuesto (varios documentos oficiales en un solo archivo DOF):

**Ejemplo:** `2022/11/14112022/MAT/006_DOF_20221114_MAT_5671254.md` (63 KB, 28 headings)

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

Cada H2 es un documento distinto. Los H3 son casi siempre "Al margen un sello con el Escudo Nacional..." — metadato que se puede ignorar para chunking.

**Ejemplo 2:** `2023/11/08112023/VES/001_DOF_20231108_VES_5708044.md` (70 KB, 26 headings)

```markdown
## CONVENIO de Coordinación que celebran la Secretaría de Medio Ambiente...

## AVISO por el que se informa al público en general que está a su
disposición el estudio realizado por la Comisión Nacional...

## AVISO por el que se informa al público en general...
```

Cada heading marca un documento independiente dentro del archivo DOF del día.

## Patrón 2: Líneas en negritas (50% del corpus ≥ 10 KB)

Documentos que usan `**TEXTO**` como separadores visuales. Pandoc los conservó como negritas en lugar de convertirlos a headings.

La mayoría son avisos de licitaciones, convocatorias y formatos administrativos. El patrón típico:

**Ejemplo:** `2023/08/08082023/MAT/099_AVISO_20230808_MAT_5697940.md` (10 KB)

```markdown
**FISCALIA GENERAL DE LA REPUBLICA**

OFICIALIA MAYOR

DIRECCION GENERAL DE RECURSOS MATERIALES Y SERVICIOS GENERALES

**LIC. EDUARDO MARTINEZ FRAUSTO**

**(R.- 540204)**

La Fiscalía General de la República, en cumplimiento a lo que
establece el artículo 134 de la Constitución Política...
```

Las líneas en negritas son: dependencia, nombre del responsable, número de registro. No son verdaderas secciones de contenido — son metadato del encabezado del documento.

En el extremo grande, los "bold docs" son los anexos de la Resolución Miscelánea Fiscal (30-40 MB de tablas):

**Ejemplo:** `2024/01/15012024/MAT/001_DOF_20240115_MAT_5714324.md` (39 MB)

```markdown
> PODER EJECUTIVO

SECRETARIA DE HACIENDA Y CREDITO PUBLICO

ANEXO 1-A de la Resolución Miscelánea Fiscal para 2024...

**Trámites Fiscales**

**II. Trámites**

**Ley de Ingresos de la Federación.**
```

Solo 4 bold lines en 39 MB — el resto son miles de tablas. El chunking por negritas no aplica aquí; necesitarían chunking por tablas o tamaño.

## Patrón 3: Texto plano (2.4%)

Sin headings ni negritas. Son edictos y notificaciones judiciales. Al ser medianos (10-30 KB), un chunking por tamaño fijo funciona bien.

## Implicaciones para el chunker

La estrategia depende del tamaño del documento:

| Tamaño | Estrategia | Justificación |
|--------|-----------|---------------|
| < 10 KB (74%) | Sin chunking | Un solo chunk basta |
| 10-100 KB (13%) | Headings → negritas → tamaño fijo | Mixto: 38% headings, 58% negritas |
| 100 KB-1 MB (6%) | Headings (62% tienen) | La mayoría ya está estructurado |
| > 1 MB (1%) | Headings + fallback por tablas | 69% con headings, el resto son tablas gigantes |

Para los documentos compuestos (varios documentos en un solo archivo), cada H2 es típicamente un documento independiente — el chunking natural por H2 funciona bien.

## Siguientes pasos

- Implementar el chunker híbrido
- Definir tamaño máximo de chunk (~1000 tokens con overlap de ~100)
- Decidir estrategia para tablas muy grandes (¿chunk por fila? ¿resumir con LLM?)
