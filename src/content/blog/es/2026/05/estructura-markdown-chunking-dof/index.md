---
title: "Estructura del markdown DOF: qué tan viable es el chunking por headings"
description: "Análisis de la estructura de 131,830 documentos markdown del DOF (2020-2026) para determinar si el chunking por headings es viable, o si necesitamos estrategias alternativas."
pubDate: "2026-05-22"
heroImage: ""
category: "desarrollo"
tags: ["dof-rag", "chunking", "markdown", "análisis"]
author: "Joaquín Bravo Contreras"
---

## Contexto

Antes de construir el chunker para el RAG, queríamos saber: ¿los documentos del DOF tienen suficiente estructura (headings) para un chunking por secciones? La respuesta corta: **sí, pero no con headings estándar**.

Analizamos los 131,830 documentos markdown del DOF correspondientes a 2020-2026.

## Estadísticas generales

| Métrica | Valor |
|---------|-------|
| Documentos totales | 131,830 |
| Tamaño mediano | 3,719 bytes |
| Tamaño medio | 75,700 bytes |
| P75 | 7,579 bytes |
| P90 | 44,684 bytes |
| P95 | 220,401 bytes |

El 75% de los documentos pesa menos de 8 KB — son avisos, edictos, convocatorias cortas. El top 25% (33K docs, los más grandes) son los que realmente necesitan chunking inteligente. Un aviso de 2 KB se puede indexar completo sin partirlo.

## Análisis del top 25% (33K documentos)

Clasificamos cada documento según su estructura dominante:

| Patrón | Cantidad | % | Descripción |
|--------|----------|---|-------------|
| Líneas en **negritas** | 18,550 | 56.3% | Usan `**TEXTO**` como pseudo-headings |
| H2/H3 estándar | 13,676 | 41.5% | Tienen `##` o `###` |
| Texto plano | 660 | 2.0% | Sin estructura detectable |
| Artículos legales | 32 | 0.1% | "Artículo N..." como estructura |
| Numerales romanos | 24 | 0.1% | "PRIMERO", "SEGUNDO"... |
| Solo tablas | 16 | 0.0% | Tablas sin otro contenido |

### Patrón 1: H2/H3 estándar (41.5%)

El caso ideal. Pandoc generó headings correctamente y el chunking es directo.

**Ejemplo:** `2020/08/14082020/MAT/006_DOF_20200814_MAT_5598397.md` (7.6 KB)

```markdown
# SECRETARIA DEL TRABAJO Y PREVISION SOCIAL

## CONVOCATORIA para la Convención Obrero Patronal de la revisión integral
del Contrato Ley de las Industrias Azucarera, Alcoholera y Similares...

### Al margen un sello con el Escudo Nacional, que dice: ...

> **ASUNTO** CONVOCATORIA PARA LA CONVENCIÓN OBRERO PATRONAL...
```

**Ejemplo 2:** `2022/10/18102022/MAT/004_DOF_20221018_MAT_5668611.md` (7.6 KB)

```markdown
# SECRETARIA DE LA FUNCION PUBLICA

## CIRCULAR por la que se comunica a las dependencias y entidades...

### Al margen un sello con el Escudo Nacional, que dice: ...
```

Los headings suelen ser: el H1 es la secretaría/dependencia, el H2 es el título del documento, y el H3 es la nota del escudo nacional. El contenido real empieza después.

### Patrón 2: Líneas en negritas (56.3%) — el más común

La mayoría de los documentos del DOF no tienen headings markdown. En su lugar, usan **texto en negritas** como separadores visuales de sección. Pandoc los convirtió a `**TEXTO**` en lugar de `## TEXTO`.

**Ejemplo:** `2023/08/08082023/MAT/099_AVISO_20230808_MAT_5697940.md` (7.6 KB)

```markdown
**FISCALIA GENERAL DE LA REPUBLICA**

OFICIALIA MAYOR

DIRECCION GENERAL DE RECURSOS MATERIALES Y SERVICIOS GENERALES

**LIC. EDUARDO MARTINEZ FRAUSTO**

**(R.- 540204)**

La Fiscalía General de la República, en cumplimiento a lo que establece
el artículo 134 de la Constitución Política de los Estados Unidos Mexicanos...
```

**Ejemplo 2:** `2020/02/25022020/MAT/063_AVISO_20200225_MAT_5587447.md` (7.6 KB)

```markdown
**INSTITUTO ELECTORAL DE LA CIUDAD DE MEXICO**

SECRETARIA ADMINISTRATIVA

DIRECCION DE ADQUISICIONES, CONTROL PATRIMONIAL Y SERVICIOS

**CONVOCATORIA DE LA LICITACION PUBLICA NACIONAL IECM-LPN-03/20**

**MTRO. ALEJANDRO FIDENCIO GONZALEZ HERNANDEZ**

**(R.- 492678)**
```

El patrón es consistente: la primera línea en negritas es la dependencia/entidad, seguida de la estructura organizacional en texto plano, y luego más negritas para el título del documento y los datos del responsable.

### Patrón 3: Texto plano (2.0%)

Sin headings, sin negritas, sin estructura clara. Son edictos, notificaciones y documentos judiciales cortos.

**Ejemplo:** `2025/07/28072025/MAT/018_AVISO_20250728_MAT_5763981.md` (7.6 KB)

```markdown
Estados Unidos Mexicanos

Fiscalía General de la República

Fiscalía Federal en Nuevo León

NOTIFICACIÓN POR EDICTO

En cumplimiento a los acuerdos dictados dentro de los autos de las
diversas carpetas de investigación, de las cuales se decretó el
aseguramiento ministerial de diversos bienes...
```

**Ejemplo 2:** `2024/04/29042024/MAT/027_AVISO_20240429_MAT_5724989.md` (8.1 KB)

```markdown
Estados Unidos Mexicanos

Poder Judicial del Estado de Baja California

Juzgado Noveno de lo Civil, Mexicali, B.C.

EDICTO

BLOQUERA MODERNA S.A. DE C.V.

En los autos del juicio ESPECIAL MERCANTIL...
```

La estructura es: institución en texto plano, seguida del cuerpo del documento. Al ser cortos (< 8 KB), un chunking por tamaño fijo funciona bien.

### Patrones menores: Artículos y numerales romanos (< 0.2%)

Los documentos con "Artículo N" o "PRIMERO, SEGUNDO..." son raros en el top 25%. Suelen ser documentos que referencian artículos legales como parte de su texto, no como estructura.

## Implicaciones para el chunker

Un chunker híbrido que siga este orden cubre ~98% de los documentos grandes:

1. **Headings H2/H3** → chunk por sección (41.5%)
2. **Líneas en negritas** (`**TEXTO**`) → tratar como pseudo-headings (56.3%)
3. **Fallback por tamaño** → párrafos de ~1000 tokens con overlap (2.0% + edge cases)

El 75% de los documentos pesa < 8 KB y probablemente no necesita chunking — un solo chunk basta. El chunking inteligente solo aplica al top 25%.

## Siguientes pasos

- Implementar el chunker híbrido
- Definir tamaño máximo de chunk (~1000 tokens con overlap de ~100)
- Decidir si los documentos < 8 KB se indexan completos
