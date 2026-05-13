---
title: '657 mil documentos después: cómo convertimos TODO el DOF a Markdown'
date: 2026-04-20T06:00:00.000Z
author: Equipo DOF-RAG
description: >-
  De 657,867 archivos .doc del Diario Oficial de la Federación a Markdown
  limpio: herramientas, resultados y lo que falta por hacer.
tags:
  - DOF-RAG
  - conversión de documentos
  - Markdown
  - LibreOffice
  - Pandoc
  - catdoc
featured: true
---

# 657 mil documentos después: cómo convertimos TODO el DOF a Markdown

En el [post anterior](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/11/cuatro-pasos-para-domar-el-dof-conversin-limpieza-anlisis-y-estructura/) describimos nuestro pipeline de procesamiento del DOF en cuatro pasos. Ahora vamos a hablar de lo que implicó convertir los **657,867 archivos .doc** del Diario Oficial de la Federación a Markdown: qué usamos, qué encontramos y qué sigue.

## El dataset

657,867 archivos .doc. Enero de 1999 a abril de 2026. Veintisiete años de documentos gubernamentales: leyes, decretos, avisos, convocatorias, resoluciones. Todo en formato Word binario. El directorio fuente pesa **71 GB**.

Necesitábamos convertir todo a Markdown limpio para generar embeddings y construir el sistema RAG.

## El pipeline

Nuestro `convert_doc_to_md.py` usa un flujo de dos pasos:

```
.doc → [LibreOffice headless] → .docx → [pandoc + filtro Lua] → .md
```

- **LibreOffice** convierte el .doc binario a .docx (XML moderno)
- **pandoc** con nuestro filtro Lua personalizado (`dof_headers.lua`) convierte el .docx a Markdown, preservando la estructura de encabezados del DOF

Configuración: 4 workers paralelos, timeout de 600 segundos por archivo, hasta 3 reintentos.

## Resultados

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

### Cobertura verificada

Comparamos nuestros archivos .doc contra los 6,079 PDFs completos por edición que tenemos descargados (2002-2025):

- Todos los días laborables con PDF tienen correspondiente .doc
- 2 fechas faltantes se identificaron y descargaron (2002-01-28: +24 docs, 2005-08-09: +181 docs)
- 2 ediciones extraordinarias de fin de semana son solo-PDF escaneado (no existen versiones Word)
- Pre-1999: no hay archivos word en el sitio del DOF, solo PDFs escaneados

## Las imágenes

Durante la conversión descubrimos que el ~1.7% de los archivos (~10,800) tenían referencias a imágenes rotas. Pandoc se ejecutó sin `--extract-media`, así que los .md decían `![](media/imagen.png)` pero las imágenes nunca se extrajeron.

La solución: agregar `--extract-media` al comando de pandoc y reconvertir esos archivos. Resultado: **90,370 imágenes** extraídas correctamente (~25 GB adicionales).

## Los archivos que LibreOffice no pudo procesar

LibreOffice cubrió el 99.90%. Los 640 archivos restantes (principalmente AVISOS del sistema SIDOF) fallaban por timeout o formato no reconocido.

Usamos el comando `file` de Linux para ver qué había realmente detrás de esas extensiones .doc, y resultó que no todos eran iguales:

### catdoc — archivos .doc legítimos

La mayoría eran .doc en formato OLE (Word 97-2003). LibreOffice se colgaba con su tamaño o complejidad. **`catdoc`** extrae texto directamente del formato binario sin intentar renderizar nada:

```bash
catdoc archivo.doc > archivo.md
```

Extrajo texto limpio de los 640 archivos en menos de un segundo cada uno.

### python-docx — archivos .docx con extensión .doc

Algunos archivos tenían `PK` como primeros bytes (firma ZIP), o sea que eran .docx (Office 2007+) con extensión .doc. Para estos usamos **`python-docx`**:

```python
from docx import Document

doc = Document("archivo.doc")  # En realidad es .docx
for paragraph in doc.paragraphs:
    print(paragraph.text)
```

### Resumen

| Método | Archivos | Resultado |
|--------|----------|-----------|
| LibreOffice + pandoc | 657,227 | ✅ Exitoso |
| `catdoc` | 640 | ✅ Exitoso |
| `python-docx` | 1 | ✅ Exitoso |
| **Total** | **657,867** | **100% convertido** |

El tradeoff de usar `catdoc` y `python-docx` es que solo extraen texto plano: sin imágenes, sin estructura de encabezados (h1, h2, h3...). Los Markdown que produce LibreOffice + pandoc sí tienen jerarquía de títulos y las imágenes embebidas, que es información valiosa para el RAG. Pero mejor tener el texto sin formato que no tener nada — estos 640 archivos representan menos del 0.1% del total.

## Distribución por año

El DOF no publica la misma cantidad todos los años:

| Año | Documentos | Observación |
|-----|-----------|-------------|
| 2014 | 31,620 | Año pico |
| 2013 | 30,582 | |
| 2012 | 30,012 | |
| 2011 | 29,623 | |
| 2020 | 16,733 | Menor (pandemia) |
| 2026 | 5,436 | Datos parciales (ene-abr) |

2011-2014 fue el periodo con más publicaciones. Desde entonces la tendencia va a la baja.

## Distribución por tamaño

Hay dos tipos de documentos con perfiles muy distintos:

**AVISOS** (88% del total, promedio 21 KB): edictos, nombramientos, convocatorias, licitaciones. La mayoría son documentos cortos de 1-2 páginas.

**Documentos DOF** (12% del total, promedio 265 KB): decretos, leyes, reglamentos, acuerdos. Aquí sí hay documentos extensos — el 30% tiene entre 10 y 100 KB (varias páginas) y un 30% supera los 100 KB (decenas de páginas).

| Categoría | Ejemplo | % del total |
|-----------|---------|-------------|
| Minúsculos (<1 KB) | Portadas, fe de erratas | ~3% |
| Pequeños (1-10 KB) | Avisos, edictos | ~71% |
| Medianos (10-100 KB) | Documentos normales | ~20% |
| Grandes (100 KB-1 MB) | Decretos, reglamentos extensos | ~5% |
| Muy grandes (>1 MB) | Tarifas arancelarias, listados | ~1% |

## Lo que nos dejó este proceso

1. **No dependas de una sola herramienta.** LibreOffice cubre el 99.9%, pero ese 0.1% restante te va a doler si no tienes un plan B. `catdoc` y `python-docx` como respaldo hicieron la diferencia entre "casi terminamos" y "100% convertido".

2. **Verifica el formato real, no la extensión.** Que un archivo diga `.doc` no significa que sea .doc. Verificar los magic bytes (`PK` = ZIP, `ÐÏ` = OLE) te ahorra horas de debugging.

3. **Cuando algo falla consistentemente, cambia de estrategia.** Reintentar con el mismo timeout solo desperdicia tiempo. Detectar los archivos problemáticos y usar otra herramienta fue más eficiente.

4. **Las imágenes importan.** El primer run sin `--extract-media` dejó ~10,800 archivos con referencias rotas. Siempre verifica que los outputs tengan todo lo que el contenido referencia.

5. **Verifica contra fuentes externas.** Comparar contra los PDFs completos nos permitió encontrar 2 fechas faltantes que ni sabíamos que teníamos.

6. **Procesamiento paralelo es indispensable.** A ~8 archivos/segundo con 4 workers, la conversión tomó varias horas. Secuencialmente habría tardado días.

## Lo que sigue: PDFs escaneados

Los 657,867 archivos Markdown están listos, pero no son todo el DOF.

Antes de 1999 el DOF solo existía en papel. El sitio del DOF digitalizó esas ediciones como PDFs escaneados — imágenes de cada página, sin texto extraíble. También hay PDFs escaneados para algunos periodos posteriores donde no hay archivos .word.

Hemos descargado 6,079 ediciones en PDF (2002-2025, 102 GB). Faltan los PDFs de 1990-2001 — unos 12 años, aproximadamente 3,000 ediciones más. Estimamos entre **650,000 y 850,000 páginas escaneadas** en total: décadas de leyes, decretos y avisos que actualmente solo existen como imágenes.

### OCR con modelos de visión-lenguaje

Los modelos de OCR basados en VLMs han avanzado mucho. Referencias recientes como el [trabajo de Daniel van Stren](https://danielvanstrien.xyz/posts/2026/re-ocr-collections/) y los [benchmarks de LightOn](https://lighton.ai/lighton-blogs/open-source-lightonocr-2-just-outscored-claude-gpt-5-qwen3-mistral-and-mathpix-at-table-extraction) muestran que modelos como **LightOnOCR-2** (1B parámetros, Apache 2.0) pueden procesar documentos escaneados a ~$0.002 por página con calidad profesional — superando incluso a GPT-5 mini y Claude Sonnet 4.6 en extracción de tablas.

El plan:

1. **Descargar** los PDFs faltantes (1990-2001)
2. **Ejecutar OCR** con modelos VLM via Hugging Face Jobs (GPU en la nube)
3. **Generar Markdown** limpio a partir de las imágenes escaneadas
4. **Integrar** con los 657,867 archivos .md ya existentes

Costo estimado: **~$800-1,500 USD** para toda la colección. Menos de lo que cuesta un café por día durante un año para digitalizar décadas del registro oficial de México.

Más allá del RAG, esto tiene un valor enorme como patrimonio documental. Cualquiera que haya intentado buscar una ley o decreto de los 90s en el sitio del DOF sabe la frustración: PDFs escaneados que no se pueden buscar, páginas que hay que hojear una por una. Digitalizar esto es un servicio público.

Eso será para otro post :-p

El código de conversión está disponible en nuestro [repositorio de GitHub](https://github.com/CodeandoGuadalajara/dof-rag).

---

*Este post es parte de la serie de documentación del proyecto [DOF-RAG](https://github.com/CodeandoGuadalajara/dof-rag), una iniciativa de [Codeando Guadalajara](https://codeandoguadalajara.github.io/) para hacer accesible la información del Diario Oficial de la Federación mediante inteligencia artificial.*
