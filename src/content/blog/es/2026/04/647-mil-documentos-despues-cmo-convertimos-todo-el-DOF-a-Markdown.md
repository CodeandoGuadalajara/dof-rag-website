---
title: '647 mil documentos después: cómo convertimos TODO el DOF a Markdown'
date: 2026-04-20T06:00:00.000Z
author: Equipo DOF-RAG
description: >-
  De 647,017 archivos .doc del Diario Oficial de la Federación a Markdown
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

# 647,017 documentos: la conversión masiva que sí terminó

Si [ya platicamos](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/11/cuatro-pasos-para-domar-el-dof-conversin-limpieza-anlisis-y-estructura/) de nuestro pipeline de procesamiento —la versión elegante con sus cuatro pasos bien definidos— ahora toca hablar de la versión real: la que convirtió **todos** los archivos .doc del DOF. Sin excepción. Sin "ya quedan unos pocos pero no pasa nada".

Spoiler: sí pasaba. Y la solución fue más creativa de lo que esperábamos.

## El número: 647,017

Ese es el total de archivos .doc que tiene el Diario Oficial de la Federación desde 1999 hasta 2025. Veintisiete años de documentos gubernamentales: leyes, decretos, avisos, convocatorias, resoluciones... todo lo que el gobierno publica oficialmente, en formato Word binario.

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
| Archivos procesados | 647,017 |
| Exitosos | 646,986 (99.995%) |
| Fallidos | 31 (0.005%) |
| Velocidad promedio | ~8.7 archivos/segundo |
| Duración del bulk | ~20 horas |
| Tamaño .doc original | 71 GB |
| Tamaño .md resultante | 33 GB |

El 99.995% de cobertura es excelente. Pero esos 31 archivos... ahí estaba el problema.

## Los 31 rebeldes

LibreOffice simplemente no podía con ellos. Dos tipos de falla:

- **Timeout (26 archivos):** LibreOffice se quedaba colgado procesándolos. Ni 600 segundos × 3 reintentos fueron suficientes. Estos archivos son documentos extremadamente largos — tarifas arancelarias completas, listados interminables, documentos con cientos de miles de líneas.
- **Formato no reconocido (5 archivos):** LibreOffice simplemente los rechazaba. "No es un documento de Word válido", decía.

El problema: cada intento de reintento tomaba 30 minutos por archivo (timeout × reintentos). Estábamos gastando **15 horas** en 31 archivos que no avanzaban. Algo tenía que cambiar.

## La solución alternativa: herramientas de nicho

Analizamos los archivos fallidos y descubrimos que no todos eran iguales. Usamos el comando `file` de Linux para ver qué había realmente detrás de esas extensiones .doc:

### Descubrimiento 1: archivos .doc binarios (OLE)

La mayoría (26 de 31) eran archivos .doc legítimos en formato OLE (Word 97-2003). LibreOffice simplemente se ahogaba con su tamaño o complejidad. Pero ahí estaba **`catdoc`**, una herramienta minimalista que extrae texto directamente del formato binario sin intentar renderizar nada.

```bash
catdoc archivo.doc > archivo.md
```

¿El resultado? Extrajo texto limpio de los 26 archivos en menos de un segundo cada uno. Sin timeouts. Sin drama. Uno de ellos tenía **303,380 líneas** y 5.9 MB de texto. `catdoc` lo procesó instantáneamente.

### Descubrimiento 2: archivos .doc que en realidad son .docx

Los 5 restantes tenían algo peculiar: sus primeros bytes eran `PK`, la firma de un archivo ZIP. En otras palabras, eran archivos .docx (formato Office 2007+) disfrazados con extensión .doc. LibreOffice los rechazaba porque esperaba formato binario OLE, no un ZIP.

Para estos usamos **`python-docx`**, que maneja perfectamente el formato Office Open XML:

```python
from docx import Document

doc = Document("archivo.doc")  # En realidad es .docx
for paragraph in doc.paragraphs:
    print(paragraph.text)
```

### Resultado final

| Método | Archivos | Resultado |
|--------|----------|-----------|
| LibreOffice + pandoc | 646,986 | ✅ Exitoso |
| `catdoc` | 25 | ✅ Exitoso |
| `python-docx` | 5 | ✅ Exitoso |
| **Total** | **647,017** | **100% convertido** |

## Distribución: ¿cuánto documento por año?

Una curiosidad que descubrimos al ver los resultados: el DOF no publica la misma cantidad todos los años.

| Año | Documentos | Observación |
|-----|-----------|-------------|
| 2014 | 31,620 | Año pico |
| 2012 | 30,012 | |
| 2013 | 30,582 | |
| 2011 | 29,623 | |
| 2020 | 16,733 | Menor (pandemia) |
| 2025 | 15,643 | Datos parciales |

El periodo 2011-2014 fue la era dorada de la publicación en el DOF. Desde entonces, la tendencia va a la baja. Curioso.

## Distribución de tamaños

¿Qué tan grandes son los archivos Markdown resultantes?

| Categoría | Tamaño | Cantidad | % del total |
|-----------|--------|----------|-------------|
| Pequeños (1-10 KB) | El aviso típico | 461,528 | 71.3% |
| Medianos (10-100 KB) | Documentos normales | 128,640 | 19.9% |
| Grandes (100 KB-1 MB) | Documentos extensos | 33,062 | 5.1% |
| Muy grandes (>1 MB) | Tarifas, listados | 5,308 | 0.8% |
| Minúsculos (<1 KB) | Portadas, fe de erratas | 18,479 | 2.9% |

La mayoría son documentos cortos — avisos, nombramientos, fe de erratas. Pero hay un 6% que son documentos serios, y un 0.8% que son verdaderos monstruos.

## Lecciones aprendidas

1. **No dependas de una sola herramienta.** LibreOffice cubre el 99.995%, pero ese 0.005% restante te va a doler si no tienes un plan B. Tener `catdoc` y `python-docx` como respaldo hizo la diferencia entre "casi terminamos" y "100% convertido".

2. **Verifica el formato real, no la extensión.** Que un archivo diga `.doc` no significa que sea .doc. Verificar los magic bytes (`PK` = ZIP, `ÐÏ` = OLE) te ahorra horas de debugging.

3. **El timeout mata la productividad.** Cuando un archivo falla consistentemente, reintentar con el mismo timeout solo desperdicia tiempo. Detectar los archivos problemáticos y cambiar de estrategia es más eficiente.

4. **La reducción de tamaño es significativa.** De 71 GB en .doc a 33 GB en .md: más de la mitad del espacio se ahorró, y el texto es mucho más accesible para procesamiento con IA.

5. **Procesamiento paralelo es indispensable.** A 8.7 archivos/segundo con 4 workers, la conversión tomó ~20 horas. Secuencialmente habría tardado más de 3 días.

## ¿Qué sigue?

Los 647,017 archivos Markdown están listos. El siguiente paso en el pipeline es la generación de embeddings para construir el sistema de búsqueda semántica. Pero esa es una historia para otro post.

El código de conversión está disponible en nuestro [repositorio de GitHub](https://github.com/CodeandoGuadalajara/dof-rag).

---

*Este post es parte de la serie de documentación del proyecto [DOF-RAG](https://github.com/CodeandoGuadalajara/dof-rag), una iniciativa de [Codeando Guadalajara](https://codeandoguadalajara.github.io/) para hacer accesible la información del Diario Oficial de la Federación mediante inteligencia artificial.*
