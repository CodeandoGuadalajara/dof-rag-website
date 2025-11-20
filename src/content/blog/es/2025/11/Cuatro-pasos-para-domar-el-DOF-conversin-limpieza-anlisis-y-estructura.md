---
title: 'Cuatro pasos para procesar el DOF: conversión, limpieza, análisis y estructura'
date: 2025-11-19T06:00:00.000Z
author: Equipo DOF-RAG
description: >-
  Del archivo WORD descargado al Markdown estructurado listo para embeddings: un
  recorrido por nuestro pipeline de procesamiento completo que incluye
  conversión con LibreOffice, filtros LUA personalizados, análisis de imágenes
  con Gemini y arquitectura de directorios robusta.
tags:
  - DOF-RAG
  - pipeline
  - Gemini
  - LibreOffice
  - Pandoc
  - Markdown
  - WORD
---

# De WORD caótico a Markdown estructurado: el pipeline completo

Después de [cambiar nuestra estrategia de PDFs a archivos WORD](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/11/del-pdf-al-word-cuando-el-costo-computacional-dicta-el-cambio-de-estrategia/), enfrentamos un nuevo desafío: convertir esos archivos WORD en Markdown limpio, estructurado y listo para generar embeddings. No bastaba con una conversión simple; necesitábamos preservar la estructura, limpiar estilos innecesarios, extraer y analizar imágenes, y organizar todo de manera escalable.

La solución fue construir un pipeline de cuatro pasos bien definidos, cada uno con su propia responsabilidad. Este post documenta cómo funciona este flujo de trabajo que procesa miles de documentos gubernamentales diariamente.

## El pipeline en contexto: de la descarga al embedding

Antes de entrar en detalles técnicos, veamos el panorama completo:

```
1. Descargar archivos WORD desde dof.gob.mx.
2. Convertir y unificar ediciones de los documentos.
3. Transformar los documentos a Markdown.
4. Analizar las imágenes y agregar descripciones
   ↓
5. Generación de embeddings (siguiente fase del proyecto)
```

## Paso 1: Descarga de archivos WORD

**Script:** `get_word_dof.py`\
**Input:** Fechas y ediciones deseadas\
**Output:** Archivos `.doc` organizados por fecha/edición

Ya cubrimos este paso en detalle en [nuestro post anterior](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/11/del-pdf-al-word-cuando-el-costo-computacional-dicta-el-cambio-de-estrategia/), pero vale la pena mencionar un desafío técnico interesante que enfrentamos:

### El misterio del error 204

El sitio del DOF tiene botones para descargar archivos WORD directamente. El problema es que al intentar acceder a esas URLs programáticamente, el servidor responde con un **HTTP 204 (No Content)** - básicamente un "sí, recibí tu petición, pero no te voy a dar nada".

**Estructura de salida:**

```
dof_word/
└── 2025/
    └── 01/
        └── 02012025/
            ├── MAT/
            │   ├── 001_DOF_20250102_MAT_5736291.doc
            │   └── 002_DOF_20250102_MAT_5736292.doc
            └── VES/
                └── 001_DOF_20250102_VES_5736450.doc
```

## Paso 2: Conversión DOC → DOCX con LibreOffice

**Script:** `dof_processor.py`\
**Input:** Archivos `.doc` del paso 1\
**Output:** Archivos `.docx` individuales + documentos unificados por edición

Este paso resuelve un problema fundamental: los archivos `.doc` (formato binario antiguo de Microsoft) son difíciles de procesar directamente. Necesitábamos convertirlos a `.docx` (formato XML moderno) para poder manipularlos con herramientas estándar.

### ¿Por qué LibreOffice y no otras alternativas?

Evaluamos varias opciones:

* **Microsoft Office API**: Requiere licencia y solo funciona en Windows
* **python-docx**: No puede leer archivos `.doc`, solo `.docx`
* **LibreOffice headless**: **Open source, multiplataforma y robusto** ✅

La decisión de usar LibreOffice fue estratégica: queríamos una solución completamente open source que cualquiera pudiera replicar sin depender de software propietario.

### Arquitectura de directorios: separación de responsabilidades

Un principio clave de nuestro diseño es **tratar los archivos DOC como biblioteca de solo lectura**. Nunca modificamos los originales descargados:

```
dof_word/          # Solo lectura - biblioteca original
└── 2025/01/02012025/MAT/
    └── archivo.doc

dof_docx/          # Archivos procesados - modificables
└── 2025/01/02012025/MAT/
    ├── archivo.docx
    └── 02012025_MAT.docx  # Documento unificado
```

Esta separación tiene ventajas importantes:

* **Re-procesamiento sin re-descarga**: Si algo falla, podemos volver a procesar sin descargar de nuevo
* **Experimentación segura**: Podemos probar diferentes conversiones sin riesgo
* **Auditoría**: Siempre tenemos los archivos originales para comparación

### El desafío de LibreOffice: timeouts

LibreOffice en modo headless es una buena herramienta pero es temperamental. Algunos documentos complejos causan que el proceso se quede "colgado" indefinidamente. Nuestra solución:

```python
# Timeout de 90 segundos por archivo
timeout_seconds = 90

# Ejecución con control de timeout
result = subprocess.run(
    ['soffice', '--headless', '--convert-to', 'docx', ...],
    timeout=timeout_seconds
)
```

Si un archivo excede el timeout, lo marcamos como problemático y continuamos. El script genera un reporte al final:

```
archivos_problematicos_20251119_143022.txt
- archivo_complejo_1.doc (timeout 90s)
- archivo_corrupto_2.doc (error de conversión)
```

**Métricas reales (medición sobre 14 archivos):**

* **Tiempo total de conversión**: \~9 segundos para 14 archivos
* **Velocidad promedio**: \<1 segundo por archivo
* **Tasa de éxito**: \~97% (3% requiere intervención manual)
* **Documentos unificados**: 1 por edición (MAT/VES) por día

## Paso 3: DOCX → Markdown con Pandoc

**Script:** `dof_docx_to_md.py`\
**Input:** Archivos `.docx` del paso 2\
**Output:** Archivos `.md` con imágenes extraídas

Este es donde ocurre la magia de la conversión real. Usamos **Pandoc**, la navaja suiza de conversión de documentos, con filtros LUA personalizados para manejar las particularidades del DOF.

### El problema de los estilos de Word

Los documentos del DOF usan estilos de Word con nombres específicos para estructurar el contenido:

* `CABEZA` → Debe ser H1 en Markdown
* `Titulo 1` → Debe ser H2
* `Titulo 2` → Debe ser H3
* `ANOTACION` → Debe ser H4

Pandoc por sí solo no sabe cómo mapear estos estilos personalizados. Aquí entran los filtros LUA.

### Filtros LUA: el traductor de estilos

Creamos `dof_headers.lua`, un filtro que intercepta los elementos del documento durante la conversión y los transforma según reglas específicas:

```lua
local style_map = {
  ["CABEZA"] = 1,      -- H1
  ["Titulo 1"] = 2,    -- H2
  ["Titulo 2"] = 3,    -- H3
  ["ANOTACION"] = 4,   -- H4
}
```

### Extracción de imágenes

Pandoc maneja automáticamente la extracción de imágenes incrustadas:

```python
pandoc_cmd = [
    'pandoc',
    str(docx_path),
    '--extract-media', str(images_dir),  # Extrae imágenes aquí
    '--lua-filter', str(lua_filter_headers),
    '-o', str(output_path)
]
```

**Métricas reales (medición sobre 14 archivos):**

* **Tiempo total de conversión**: \~4 segundos para 14 archivos
* **Velocidad promedio**: \<0.5 segundos por archivo
* **Imágenes extraídas**: 55 imágenes en esta ejecución
* **Timeout configurado**: 300-600 segundos según tamaño del archivo

## Paso 4: Análisis de imágenes con Gemini

**Script:** `dof_image_analyzer.py`\
**Input:** Imágenes extraídas del paso 3\
**Output:** Archivos `.md` actualizados con texto alternativo descriptivo

El último paso del pipeline agrega contexto a las imágenes usando **Gemini 2.5 Flash-Lite**, el modelo de IA de Google

### ¿Por qué analizar las imágenes?

Los documentos del DOF contienen tablas, gráficos, diagramas y escudos oficiales en formato imagen. Para un sistema RAG (Retrieval Augmented Generation), estas imágenes son "puntos ciegos" sin descripción textual.

El análisis automático de imágenes nos permite:

* **Indexar el contenido visual**: Los embeddings pueden capturar información de tablas y gráficos

**Métricas reales (medición sobre 55 imágenes):**

* **Tiempo total**: 288 segundos (\~4.8 minutos) para 55 imágenes
* **Velocidad**: \~11 imágenes por minuto (con rate limiting)
* **Precisión de descripciones**: Alta para tablas y gráficos estructurados
* **Costo**: \~0.001 USD por 1000 imágenes (Gemini Flash-Lite tier gratuito)

## El flujo completo en acción

Veamos cómo se ejecuta el pipeline completo para procesar un día del DOF:

```bash
# Paso 1: Descargar archivos WORD del 15 de marzo de 2024
uv run get_word_dof.py 15/03/2024 --editions both

# Paso 2: Convertir DOC a DOCX y unificar
uv run dof_processor.py 15/03/2024

# Paso 3: Convertir DOCX a Markdown
uv run dof_docx_to_md.py 15/03/2024

# Paso 4: Analizar imágenes con Gemini
uv run dof_image_analyzer.py 15/03/2024
```

**Tiempos reales medidos (un día completo del DOF):**

* Descarga: 46 segundos (14 archivos incluyendo avisos)
* Conversión DOC→DOCX: 9 segundos (14 archivos)
* Conversión DOCX→MD: 4 segundos (14 archivos)
* Análisis de imágenes: 288 segundos (\~4.8 minutos, 55 imágenes con rate limiting)

**Total: \~347 segundos (\~5.8 minutos) por día del DOF**

## El resultado...

Este Markdown está **listo para ser fragmentado y convertido en embeddings** para nuestro sistema RAG. Pero esa es una historia para el próximo post.

## Código abierto y replicable

Todo este pipeline está disponible en nuestro repositorio de GitHub. Cada script incluye documentación detallada en su README correspondiente:

* `dof_word/get_word_dof.py` - Descarga de archivos
* `dof_processor/dof_processor.py` - Conversión DOC→DOCX
* `pandoc_filters/dof_docx_to_md.py` - Conversión DOCX→Markdown
* `dof_image_analyzer/dof_image_analyzer.py` - Análisis de imágenes

*Todas las herramientas son open source*

*Este artículo es parte de nuestra serie sobre arquitectura y procesamiento del proyecto DOF-RAG. Para el código completo y documentación detallada, visita nuestro [repositorio en GitHub](https://github.com/CodeandoGuadalajara/dof-rag).*
