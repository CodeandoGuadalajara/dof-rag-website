---
title: 'Del PDF al WORD: cuando el costo computacional dicta el cambio de estrategia'
date: 2025-11-19T06:00:00.000Z
author: Equipo DOF-RAG
description: >-
  Cómo la realidad del procesamiento masivo de documentos nos llevó a replantear
  nuestra estrategia: de descargar PDFs completos a obtener archivos WORD
  segmentados, reduciendo dramáticamente el costo computacional sin sacrificar
  calidad.
tags:
  - DOF-RAG
  - web-scraping
  - WORD
  - PDF
---

# Cuando escalar te obliga a replantear todo (y está bien)

Hay momentos en el desarrollo de software donde la teoría se encuentra con la realidad de forma brutal. Uno de esos momentos llegó cuando intentamos escalar nuestro sistema de procesamiento de documentos del Diario Oficial de la Federación. Lo que funcionaba perfectamente con unos cuantos archivos se convirtió en una pesadilla computacional al enfrentarnos con **décadas de publicaciones diarias**.

En [nuestro análisis anterior](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/06/la-batalla-de-los-convertidores-nuestra-experiencia-extrayendo-texto-del-dof/), evaluamos exhaustivamente diferentes convertidores PDF-to-Markdown. Elegimos Marker como nuestra herramienta principal por su equilibrio entre calidad y características. Pero había un problema que ninguna optimización de código podía resolver: **el costo computacional de procesar PDFs monumentales simplemente no escalaba**.

La solucion fue replantear completamente la estrategia de origen: **dejar de descargar PDFs y empezar a trabajar con archivos WORD**.
Esta es la historia de cómo un cambio aparentemente simple en el formato de archivo transformó radicalmente nuestro pipeline de procesamiento, implementado hace aproximadamente un mes y que hoy es la base de nuestra operación.

## El problema: PDFs y el monstruo del costo computacional

### El flujo original: simple pero insostenible

Nuestro primer enfoque era directo y aparentemente elegante:

1. Descargar PDFs completos del DOF desde `diariooficial.gob.mx`
2. Procesar cada PDF (archivos de 50-200 MB cada uno)
3. Convertir a Markdown usando herramientas especializadas
4. Extraer texto estructurado para embeddings

**El script original (`get_dof.py`):**

```python
def get_url(year, month, day):
    """Generate the URL for a given date"""
    base_url = "https://diariooficial.gob.mx/abrirPDF.php?archivo="
    return f"{base_url}{day}{month}{year}-MAT.pdf&anio={year}&repo=repositorio/"
```

Simple, ¿verdad? Un endpoint, un archivo, listo.

### La realidad del escalamiento

Cuando empezamos a procesar años de publicaciones, los números dejaron de ser amigables:

* **Costo computacional:** Cada PDF requería procesamiento intensivo
* **Tiempo de conversión:** Marker tardaba \~22 minutos para un documento de 402 páginas, Docling \~39 minutos, tiempos que se volvían prohibitivos al escalar
* **Recursos de memoria:** Los PDFs completos consumían RAM considerable durante el procesamiento
* **Tasa de error:** Documentos complejos causaban fallos frecuentes en la conversión

Hacer las cuentas fue deprimente: **procesar décadas de DOFs con este enfoque requeriría semanas de cómputo continuo** y costos de infraestructura que no eran viables para un proyecto de bien público.

## Las herramientas que no escalaron

En nuestro análisis anterior sobre convertidores PDF-to-Markdown, evaluamos exhaustivamente diferentes herramientas. Los resultados fueron reveladores: todas funcionaban bien en casos individuales, pero al escalar a miles de documentos, la historia cambiaba radicalmente.

Recapitulando los hallazgos más relevantes:

### 🔧 Marker

**Promesa:** Conversión precisa con reconocimiento de estructura\
**Realidad:** Calidad notable (8.5/10), pero **1340 segundos (\~22 minutos)** para un documento de 402 páginas. Con extracción de imágenes al 90% de precisión y buen manejo de tablas, era nuestra opción preferida. Sin embargo, multiplicado por miles de documentos, el costo computacional se volvía insostenible.

### 🔧 Docling

**Promesa:** Manejo robusto de documentos complejos\
**Realidad:** **2338 segundos (\~39 minutos)** para el mismo documento de 402 páginas. Calidad similar a Marker (8/10), pero sin extracción de imágenes y con tiempos aún más prohibitivos para procesamiento masivo.

### 🔧 Otras herramientas evaluadas

También probamos **PyMuPDF** (extremadamente rápido a 6 segundos, pero con calidad casi inutilizable 2/10), **pymupdf4llm** (77 segundos con calidad 8/10 pero sin extracción de imágenes), y hasta integraciones con **Gemini** que triplicaban el tiempo sin mejoras proporcionales en calidad.

**El patrón era claro:** todas estas herramientas eran excelentes para casos de uso específicos, pero ninguna estaba diseñada para procesar miles de documentos gubernamentales complejos de manera eficiente.

No era culpa de las herramientas. Era culpa nuestra por intentar usar un martillo de precisión para demoler un edificio.

> 💡 **Para el análisis completo** con tablas comparativas, métricas detalladas y evaluación de cada herramienta, consulta nuestro post anterior: [La batalla de los convertidores](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/06/la-batalla-de-los-convertidores-nuestra-experiencia-extrayendo-texto-del-dof/).

## El descubrimiento: WORD como salvavidas inesperado

La revelación llegó al explorar más a fondo la infraestructura del DOF. Resulta que el gobierno mexicano no solo publica los PDFs monumentales, sino que también ofrece **archivos WORD individuales para cada sección del diario**.

### La arquitectura oculta del DOF

El DOF tiene dos sitios principales:

**1. dof.gob.mx** - El sitio principal con documentos completos por sección:

```python
# Estructura de URL para archivos WORD
url = f"https://www.dof.gob.mx/nota_to_doc.php?codnota={codnota}"
```

**2. sidof.segob.gob.mx** - Sistema Digital con AVISOS segmentados:

```python
# AVISOS separados por nota
url = f"https://sidof.segob.gob.mx/notas/getDoc/{note_id}"
```

Cada publicación del día está **pre-segmentada en documentos WORD individuales** por tema y sección. En lugar de un PDF monolítico de 150 MB, podíamos descargar 50 archivos WORD de 500 KB cada uno.

**Las ventajas eran evidentes:**

* ✅ Archivos más pequeños y manejables
* ✅ Ya segmentados por tema (no necesitamos detectar secciones)
* ✅ Formato WORD más fácil de procesar a Markdown
* ✅ Menor costo computacional por documento
* ✅ Paralelización trivial del procesamiento

## La nueva arquitectura: web scraping inteligente

### El desafío técnico: scraping estructurado

El problema es que estos archivos WORD no están listados en un directorio simple. Hay que extraerlos mediante web scraping de las páginas HTML del DOF.

**El nuevo script (`get_word_dof.py`) implementa:**

#### 1. Extracción de enlaces WORD del DOF principal

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

#### 2. Extracción de AVISOS desde SIDOF

Una característica adicional (y menor) del nuevo sistema es que también descarga los AVISOS que en el PDF venían incluidos pero en WORD están separados:

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
        # Detecta edición MAT/VES por el tab-pane
        # ... extrae enlaces de notas
```

Esta segmentación adicional es un efecto secundario de la arquitectura WORD, no la razón principal del cambio. Simplemente descubrimos que el contenido ya venía naturalmente separado.

#### 3. Nomenclatura estructurada y organización

El nuevo sistema genera una estructura de carpetas mucho más organizada:

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

## Aspectos técnicos: el diablo en los detalles

### Control de velocidad de descarga

Para ser buenos ciudadanos digitales y no saturar los servidores gubernamentales:

```python
@typer.Option(1.0, help="Tiempo de espera en segundos entre descargas")
sleep_delay: float

# Uso:
python get_word_dof.py 02/01/2023 --sleep-delay 1.5
```

Este parámetro permite ajustar la agresividad de las descargas según las capacidades del servidor.

### Soporte para rangos de fechas

```python
# Fecha única
python get_word_dof.py 02/01/2023

# Rango de fechas
python get_word_dof.py 01/01/2023 31/01/2023

# Ediciones específicas
python get_word_dof.py 02/01/2023 --editions mat    # Solo matutina
python get_word_dof.py 02/01/2023 --editions ves    # Solo vespertina
python get_word_dof.py 02/01/2023 --editions both   # Ambas
```

Esta flexibilidad permite descargas incrementales y actualizaciones diarias sin reprocesar todo el histórico.

## Los resultados: números que hablan

**Desde la implementación del nuevo flujo hace un mes, los resultados son contundentes:**

### Antes (Flujo PDF)

* ⏱️ **Tiempo de procesamiento:** 20-40 minutos por PDF completo del DOF (algunos de 400+ páginas)
* 💾 **Almacenamiento temporal:** 150-300 MB por archivo
* 🔥 **Uso de CPU:** 80-95% durante conversión
* ❌ **Tasa de fallos:** \~15% (documentos complejos)
* 🔄 **Re-procesamiento:** Difícil (todo el archivo)

### Ahora (Flujo WORD)

* ⏱️ **Tiempo de procesamiento:** 2-5 minutos por día de publicación (30-80 archivos pequeños procesados secuencialmente)
* 💾 **Almacenamiento temporal:** 20-50 MB por día (total de archivos)
* 🔥 **Uso de CPU:** 30-45% (con potencial de paralelización)
* ✅ **Tasa de fallos:** \~3% (archivos individuales aislados)
* 🔄 **Re-procesamiento:** Trivial (solo archivos problemáticos)

**Reducción en tiempo de procesamiento: \~85-90%**
**Reducción en costo computacional: \~70-80%**

## Lecciones aprendidas: sabiduría del campo de batalla

## El camino adelante: WORD to Markdown

El cambio a archivos WORD resolvió el problema de **adquisición** de datos, pero introdujo un nuevo desafío: **conversión de WORD a Markdown**.

### La evolución de nuestra estrategia de procesamiento

1. **[Junio 2025](https://codeandoguadalajara.github.io/dof-rag-website/es/blog/2025/06/la-batalla-de-los-convertidores-nuestra-experiencia-extrayendo-texto-del-dof/exto-del-DOF):** Evaluamos convertidores PDF-to-Markdown y elegimos Marker
2. **Octubre 2025 (este post):** Descubrimos archivos WORD segmentados y cambiamos la estrategia de adquisición
3. **Próxima entrega:** Conversión eficiente de WORD a Markdown

En nuestra próxima entrega del blog profundizaremos en:

* Tecnologías de manipulación del formato WORD (.doc y .docx)
* Estrategias de extracción de estructura y formateo
* Preservación de tablas, listas y elementos complejos
* Conversión eficiente a Markdown limpio y estructurado
* Comparación: ¿es realmente más fácil procesar WORD que PDF?

## Conclusiones: cuando cambiar es evolucionar

Este cambio de PDFs a WORD no fue planificado desde el inicio. Después de evaluar meticulosamente diferentes convertidores PDF-to-Markdown y elegir Marker como nuestra mejor opción, descubrimos que el problema real no era *cómo* procesábamos los PDFs, sino *por qué* procesábamos PDFs en primer lugar.

Fue una **evolución necesaria** dictada por la realidad del escalamiento. Y ese es un patrón común en proyectos de datos reales: **la arquitectura teóricamente perfecta a menudo cede ante la arquitectura prácticamente viable**.

**¿Es el formato WORD perfecto?** No.
**¿Es mejor que PDFs para nuestro caso de uso?** Absolutamente.
**¿Cambiaremos de nuevo en el futuro si encontramos algo mejor?** Sin duda.

*Este artículo forma parte de nuestra serie sobre las decisiones arquitectónicas y desafíos técnicos del proyecto DOF-RAG. Para detalles técnicos completos, código fuente y documentación, visita nuestro [repositorio en GitHub](https://github.com/CodeandoGuadalajara/dof-rag).*
