---
title: '657 mil documentos después: cómo convertimos TODO el DOF a Markdown'
date: 2026-04-20T06:00:00.000Z
author: Equipo DOF-RAG
description: >-
  De 657,867 archivos .doc del Diario Oficial de la Federación a Markdown
  limpio: la historia completa de nuestra conversión masiva, los obstáculos
  que encontramos y cómo herramientas como catdoc y python-docx nos
  salvaron en la recta final.
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

Si [ya platicamos](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/11/cuatro-pasos-para-domar-el-dof-conversin-limpieza-anlisis-y-estructura/) de nuestro pipeline de procesamiento —la versión elegante con sus cuatro pasos bien definidos— ahora toca hablar de la versión real: la que convirtió **todos** los archivos .doc del DOF. Sin excepción.

## El número: 657,867

Ese es el total de archivos .doc que tiene el Diario Oficial de la Federación desde enero de 1999 hasta abril de 2026. Veintisiete años de documentos gubernamentales: leyes, decretos, avisos, convocatorias, resoluciones... todo en formato Word binario.

El directorio fuente pesa **71 GB**. Y necesitábamos convertir cada uno de esos archivos a Markdown limpio para poder generar embeddings y construir nuestro sistema RAG.

## El pipeline: LibreOffice + pandoc

Nuestro `convert_doc_to_md.py` usa un flujo de dos pasos:

```
.doc → [LibreOffice headless] → .docx → [pandoc + filtro Lua] → .md
```

- **LibreOffice** convierte el .doc binario a .docx (XML moderno)
- **pandoc** con nuestro filtro Lua personalizado (`dof_headers.lua`) convierte el .docx a Markdown, preservando la estructura de encabezados del DOF

La configuración: 4 workers paralelos, timeout de 600 segundos por archivo, hasta 3 reintentos.

### Los números del bulk

Corrimos la conversión masiva con 4 workers y estos fueron los resultados:

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

Para estar seguros de que no nos faltaba nada, comparamos nuestros archivos .doc contra los 6,079 PDFs completos por edición que tenemos descargados (2002-2025):

- Todos los días laborables con PDF tienen correspondiente .doc
- 2 fechas históricas faltantes se identificaron y descargaron (2002-01-28: +24 docs, 2005-08-09: +181 docs)
- 2 ediciones extraordinarias de fin de semana confirmadas como solo-PDF escaneado (no existen versiones Word)
- Pre-1999: no hay archivos word en el sitio del DOF, solo PDFs escaneados

## Las imágenes que faltaban

Un descubrimiento importante durante la conversión: el ~1.7% de los archivos (~10,800) tenían referencias a imágenes rotas. El problema era que pandoc se ejecutó sin `--extract-media`, así que los .md decían `![](media/imagen.png)` pero las imágenes nunca se extrajeron.

La solución fue agregar `--extract-media` al comando de pandoc y reconvertir esos archivos. Resultado: **90,370 imágenes** extraídas correctamente, que suman ~25 GB adicionales al directorio de salida.

## Cuando LibreOffice dice que no

LibreOffice cubrió el 99.90% de los archivos. Pero hubo 640 archivos (principalmente AVISOS del sistema SIDOF) que simplemente lo hacían colapsar. Dos tipos de falla:

- **Timeout:** LibreOffice se quedaba colgado procesándolos. Ni 600 segundos × 3 reintentos fueron suficientes.
- **Formato no reconocido:** LibreOffice los rechazaba.

### La solución: herramientas más simples

Analizamos los archivos fallidos y descubrimos que no todos eran iguales. Usamos el comando `file` de Linux para ver qué había realmente detrás de esas extensiones .doc:

#### catdoc

La mayoría eran archivos .doc legítimos en formato OLE (Word 97-2003). LibreOffice simplemente se ahogaba con su tamaño o complejidad. Pero ahí estaba **`catdoc`**, una herramienta minimalista que extrae texto directamente del formato binario sin intentar renderizar nada.

```bash
catdoc archivo.doc > archivo.md
```

Extrajo texto limpio de los 640 archivos en menos de un segundo cada uno. Sin timeouts.

#### python-docx: para los disfrazados

Algunos archivos tenían algo peculiar: sus primeros bytes eran `PK`, la firma de un archivo ZIP. En otras palabras, eran archivos .docx (formato Office 2007+) disfrazados con extensión .doc. Para estos usamos **`python-docx`**, que maneja perfectamente el formato Office Open XML:

```python
from docx import Document

doc = Document("archivo.doc")  # En realidad es .docx
for paragraph in doc.paragraphs:
    print(paragraph.text)
```

### Resultado final

| Método | Archivos | Resultado |
|--------|----------|-----------|
| LibreOffice + pandoc | 657,227 | ✅ Exitoso |
| `catdoc` | 640 | ✅ Exitoso |
| `python-docx` | 1 | ✅ Exitoso |
| **Total** | **657,867** | **100% convertido** |

## Distribución: ¿cuánto documento por año?

Una curiosidad que descubrimos al ver los resultados: el DOF no publica la misma cantidad todos los años.

| Año | Documentos | Observación |
|-----|-----------|-------------|
| 2014 | 31,620 | Año pico |
| 2012 | 30,012 | |
| 2013 | 30,582 | |
| 2011 | 29,623 | |
| 2020 | 16,733 | Menor (pandemia) |
| 2026 | 5,436 | Datos parciales (ene-abr) |

El periodo 2011-2014 fue la era dorada de la publicación en el DOF. Desde entonces, la tendencia va a la baja.

## Distribución de tamaños

¿Qué tan grandes son los archivos Markdown resultantes?

| Categoría | Tamaño | Cantidad | % del total |
|-----------|--------|----------|-------------|
| Pequeños (1-10 KB) | El aviso típico | ~70% | Mayoría |
| Medianos (10-100 KB) | Documentos normales | ~20% | |
| Grandes (100 KB-1 MB) | Documentos extensos | ~5% | |
| Muy grandes (>1 MB) | Tarifas, listados | ~1% | |
| Minúsculos (<1 KB) | Portadas, fe de erratas | ~3% | |

La mayoría son documentos cortos — avisos, nombramientos, fe de erratas. Pero hay un 6% que son documentos serios, y un 1% que son bastante grandes.

## Lo que aprendimos

1. **No dependas de una sola herramienta.** LibreOffice cubre el 99.9%, pero ese 0.1% restante te va a doler si no tienes un plan B. Tener `catdoc` y `python-docx` como respaldo hizo la diferencia entre "casi terminamos" y "100% convertido".

2. **Verifica el formato real, no la extensión.** Que un archivo diga `.doc` no significa que sea .doc. Verificar los magic bytes (`PK` = ZIP, `ÐÏ` = OLE) te ahorra horas de debugging.

3. **Cuando algo falla consistentemente, cambia de estrategia.** Reintentar con el mismo timeout solo desperdicia tiempo. Detectar los archivos problemáticos y usar otra herramienta fue más eficiente.

4. **Las imágenes importan.** El primer run sin `--extract-media` dejó ~10,800 archivos con referencias rotas. Siempre verifica que los outputs tengan todo lo que el contenido referencia.

5. **Verifica contra fuentes externas.** Comparar contra los PDFs completos nos permitió encontrar 2 fechas faltantes que ni sabíamos que teníamos.

6. **Procesamiento paralelo es indispensable.** A ~8 archivos/segundo con 4 workers, la conversión tomó varias horas. Secuencialmente habría tardado días.

## ¿Qué sigue? Los PDFs escaneados

Los 657,867 archivos Markdown están listos. Pero hay más.

El DOF no siempre publicó archivos .doc individuales. Antes de 1999, las ediciones solo existían en papel, y el sitio del DOF las digitalizó como PDFs escaneados — imágenes de cada página, sin texto extraíble. Y cuando decimos "antes de 1999", hablamos de **décadas**: el sitio tiene PDFs desde al menos 1990, con algunas ediciones aisladas de 1920 y 1922.

¿La escala real? Analizamos lo que tenemos descargado y lo que falta:

| Periodo | Tipo de PDF | Texto extraíble |
|---------|------------|-----------------|
| 1920-1922 | Ediciones aisladas | No |
| 1990-2004 | Escaneado (imágenes) | **No** |
| 2005-2008 | Escaneado | **No** |
| 2009-2011 | Transición (mixto) | Parcial |
| 2012-2025 | Mayormente digital | Sí |

Hemos descargado 6,079 ediciones (2002-2025, 102 GB), pero **todavía faltan los PDFs de 1990-2001** — unos 12 años, aproximadamente 3,000 ediciones más. Estimamos entre **650,000 y 850,000 páginas escaneadas** en total.

### OCR con modelos de visión-lenguaje

La buena noticia es que los modelos de OCR basados en VLMs han avanzado mucho. Referencias recientes como el [trabajo de Daniel van Stren](https://danielvanstrien.xyz/posts/2026/re-ocr-collections/) y los [benchmarks de LightOn](https://lighton.ai/lighton-blogs/open-source-lightonocr-2-just-outscored-claude-gpt-5-qwen3-mistral-and-mathpix-at-table-extraction) muestran que modelos como **LightOnOCR-2** (1B parámetros, Apache 2.0) pueden procesar documentos escaneados a ~$0.002 por página con calidad profesional — superando incluso a GPT-5 mini y Claude Sonnet 4.6 en extracción de tablas.

El plan:

1. **Descargar** los PDFs faltantes (1990-2001)
2. **Ejecutar OCR** con modelos VLM via Hugging Face Jobs (GPU en la nube)
3. **Generar Markdown** limpio a partir de las imágenes escaneadas
4. **Integrar** con los 657,867 archivos .md ya existentes

Costo estimado: **~$800-1,500 USD** para toda la colección. Menos de lo que cuesta un café por día durante un año para digitalizar décadas del registro oficial de México.

Más allá del RAG, esto tiene un valor enorme como patrimonio documental. Cualquiera que haya intentado buscar una ley o decreto de los 90s en el sitio del DOF sabe la frustración: PDFs escaneados que no se pueden buscar, páginas que hay que hojear una por una. Digitalizar esto es un servicio público.

Esa es una historia para otro post :-p

El código de conversión está disponible en nuestro [repositorio de GitHub](https://github.com/CodeandoGuadalajara/dof-rag).

---

*Este post es parte de la serie de documentación del proyecto [DOF-RAG](https://github.com/CodeandoGuadalajara/dof-rag), una iniciativa de [Codeando Guadalajara](https://codeandoguadalajara.github.io/) para hacer accesible la información del Diario Oficial de la Federación mediante inteligencia artificial.*
