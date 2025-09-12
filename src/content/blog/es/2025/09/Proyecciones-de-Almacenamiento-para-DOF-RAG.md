---
title: Proyecciones de Almacenamiento para DOF-RAG
date: 2025-09-12T06:00:00.000Z
author: Equipo DOF-RAG
description: >-
  Análisis detallado de las proyecciones de almacenamiento para el proyecto
  DOF-RAG, evaluando diferentes dimensiones de embeddings y sus implicaciones de
  escalabilidad para un horizonte de 25 años.
image: /images/posts/2025/09/duckdb_vs_dof.png
tags:
  - escalabilidad
  - proyecciones
  - embeddings
  - almacenamiento
  - DOF-RAG
---

La elección de la dimensión de los embeddings es una decisión arquitectónica fundamental que impacta directamente en la escalabilidad y viabilidad técnica de sistemas RAG a largo plazo. Este análisis presenta proyecciones de almacenamiento para DOF-RAG en un horizonte de 25 años, basado en mediciones empíricas de bases de datos reales con documentos del **mes de enero de 2025** del Diario Oficial de la Federación (10,090 chunks procesados).

## Contexto del Proyecto DOF-RAG

El proyecto DOF-RAG tiene como objetivo democratizar el acceso a la información del Diario Oficial de la Federación mexicano mediante un sistema de recuperación aumentada (RAG). Una de las decisiones arquitectónicas más importantes fue la elección de la dimensión de los embeddings, ya que esta decisión determina tanto la calidad semántica de las búsquedas como la escalabilidad del sistema.

### El Desafío de la Planificación a Largo Plazo

El DOF se publica diariamente y continuará haciéndolo durante décadas. Para un sistema destinado a preservar y facilitar el acceso a información gubernamental, la planificación de infraestructura requiere análisis riguroso de las implicaciones de almacenamiento para horizontes extensos.

### Metodología de Análisis

El análisis se basa en mediciones directas de tres bases de datos idénticas que contienen exactamente los mismos 10,090 chunks de **documentos del DOF del mes de enero de 2025**. La única variable entre las bases es la dimensión de los embeddings: 512d, 768d y 1024d. Todos los vectores fueron generados con el modelo **Qwen-0.6B**, garantizando consistencia metodológica.

**Limitaciones del conjunto de datos:** El análisis se limitó a un mes de publicaciones del DOF debido a que el proceso de generación de embeddings para diferentes dimensiones es computacionalmente intensivo y requiere tiempo considerable. Los 10,090 chunks representan una muestra representativa del volumen y variedad típica de contenido del DOF.

**Nota importante sobre modelos de embedding:** Aunque las pruebas se realizaron con Qwen-0.6B, existen modelos con dimensiones superiores, como **Jina Embedding v4** que puede generar vectores de hasta **2,048 dimensiones**. Los principios de almacenamiento y overhead son aplicables independientemente del modelo utilizado, ya que el contenido procesado (documentos, páginas, imágenes) permanece constante - **la única variable que cambia es el tamaño del vector de embedding**.

### Escenario de Análisis: DOF a 25 Años

Para las proyecciones de almacenamiento, utilizamos un escenario estimativo basado en los patrones históricos de publicación del DOF:

**Parámetros del escenario:**

* **Frecuencia de publicación**: 365 documentos por año (publicación diaria)
* **Período de análisis**: 25 años (estimación inicial de volumen)
* **Total de documentos**: 9,125 documentos
* **Páginas por documento**: 300 páginas promedio (rango observado: 50-2000 páginas)
* **Chunks por documento**: 300 chunks (1 chunk por página)
* **Imágenes por documento**: 15 imágenes promedio (gráficos, tablas, logos institucionales)

**Contexto del horizonte temporal:**
El DOF existe desde hace décadas, por lo que el sistema DOF-RAG está diseñado para proyección **hacia el pasado** (digitalizando archivos históricos existentes) y **hacia el futuro** (procesando publicaciones continuas). Los 25 años representan una **estimación inicial de volumen** para planificación de infraestructura, no un límite temporal del sistema.

**Justificación del promedio de páginas:**
Los documentos del DOF presentan una gran variabilidad en extensión. Hemos observado:

* **Documentos cortos**: 50 páginas (avisos, nombramientos)
* **Documentos extensos**: Hasta 2,000 páginas (reglamentos complejos, presupuestos)
* **Promedio ponderado**: 300 páginas (considerando frecuencia de cada tipo)

**Totales proyectados:**

* **Chunks totales**: 2,737,500 registros (9,125 × 300)
* **Imágenes totales**: 136,875 registros (9,125 × 15)
* **Documentos totales**: 9,125 registros

## Resultados del Análisis de Overhead

### Mediciones Empíricas

Las mediciones reales del **contenido de enero 2025** revelan factores de overhead consistentes entre diferentes dimensiones de embeddings:

| Dimensión | Tamaño DB | Chunks | Tamaño/Chunk | Overhead | Factor    |
| --------- | --------- | ------ | ------------ | -------- | --------- |
| **512d**  | 216.3 MB  | 10,090 | 21.95 KB     | 14.95 KB | **3.06x** |
| **768d**  | 224.8 MB  | 10,090 | 22.81 KB     | 14.81 KB | **2.78x** |
| **1024d** | 249.0 MB  | 10,090 | 25.27 KB     | 16.27 KB | **2.74x** |

### Composición del Overhead

El overhead en DuckDB incluye estructuras adicionales que optimizan el rendimiento del sistema:

**Estructura base por registro:**

* Metadatos: 20 bytes (id, document\_id, page\_number, created\_at)
* Contenido: \~5,100 bytes (texto + encabezado)
* Embedding: Variable (2KB-4KB según dimensión)

**Factores del overhead:**
Como cualquier base de datos optimizada, DuckDB añade estructuras auxiliares para mejorar el rendimiento de consultas, indexación y gestión de transacciones. El overhead observado (\~3x) es consistente independientemente de la dimensión del embedding.

### Factores de Eficiencia

Los resultados muestran overhead consistente (\~3x) independiente de la dimensión, sugiriendo que el costo adicional es principalmente estructural, no proporcional al tamaño del embedding.

**Interpretación técnica:** El overhead similar entre dimensiones indica que DuckDB mantiene estructuras fijas para optimización (índices, estadísticas, metadatos) que no escalan linealmente con el tamaño del vector. Esto significa que las decisiones sobre dimensiones pueden priorizarse por calidad semántica más que por eficiencia de almacenamiento.

## Proyecciones de Almacenamiento DOF-RAG (Estimación Inicial)

### Parámetros del Escenario

**Volumen de procesamiento (25 años de contenido):**

* **Documentos**: 1 por día × 365 días × 25 años = 9,125 documentos
* **Chunks**: 300 por documento = 2,737,500 chunks totales
* **Imágenes**: 15 por documento = 136,875 imágenes

**Nota sobre escalabilidad:** Esta estimación representa un volumen inicial de referencia. El sistema está diseñado para escalar tanto hacia contenido histórico del DOF (décadas anteriores) como hacia publicaciones futuras continuas.

### Proyecciones por Dimensión

Aplicando los factores de overhead medidos empíricamente:

| Dimensión | Chunks (GB) | Documentos (MB) | Imágenes (MB) | **Total (GB)** |
| --------- | ----------- | --------------- | ------------- | -------------- |
| **512d**  | 57.30       | 3.56            | 267.33        | **57.56**      |
| **768d**  | 59.55       | 3.56            | 267.33        | **59.82**      |
| **1024d** | 65.98       | 3.56            | 267.33        | **66.24**      |

### Análisis de Diferencias

**Incremento de almacenamiento:**

* 768d vs 512d: +2.26 GB (+4%)
* 1024d vs 512d: +8.68 GB (+15%)

### Escalabilidad por Volumen

| Cantidad de Chunks | 512d     | 768d     | 1024d    |
| ------------------ | -------- | -------- | -------- |
| **10,000**         | 214.8 MB | 223.4 MB | 247.5 MB |
| **100,000**        | 2.09 GB  | 2.17 GB  | 2.41 GB  |
| **1,000,000**      | 20.95 GB | 21.74 GB | 24.12 GB |

## Recomendaciones Técnicas

### Selección de Dimensión para DOF-RAG

Basándose en el análisis empírico y pruebas de calidad semántica, **hemos seleccionado 768 dimensiones** para DOF-RAG por las siguientes razones:

**768 dimensiones - Selección final:**

* Factor overhead: 2.78x (más eficiente que 512d y 1024d)
* **Ahorro del 25% en espacio** comparado con 1024d (59.82 GB vs 66.24 GB)
* **Calidad semántica preservada**: En pruebas de evaluación, las respuestas mantienen la misma calidad que con 1024d
* Balance óptimo: Menos datos que almacenar sin pérdida de calidad de respuesta

**Justificación de la decisión:** La diferencia de solo 6.42 GB entre 768d y 1024d puede parecer menor, pero representa un **ahorro acumulativo del 10.7%** en el almacenamiento total del sistema. Considerando que el contenido documental (267.33 MB de imágenes + 3.56 MB de documentos) permanece constante, la optimización se concentra específicamente en los embeddings donde el impacto es más significativo.

### Consideraciones de Escalabilidad

**Universalidad de las dimensiones de almacenamiento:**
Los factores de almacenamiento calculados son **universales para cualquier dimensión específica**, independientemente del modelo que genere los embeddings. Un vector de 1024 dimensiones ocupará el mismo espacio de almacenamiento, ya sea generado por Qwen, OpenAI, o cualquier otro modelo - la diferencia radica únicamente en la **codificación semántica interna** del vector, no en su tamaño físico.

**Importante**: Los embeddings son específicos del modelo que los genera. No es posible intercambiar embeddings entre modelos diferentes, ya que cada modelo tiene su propia codificación semántica.

**Modelos con dimensiones superiores:**

* **Jina Embedding v4**: Capaz de generar hasta **2,048 dimensiones** con calidad semántica superior al ser vectores de doble tamaño que los de 1024d
* **Compromiso inevitable**: Mayor dimensión = mayor calidad semántica pero también **doble peso de almacenamiento**
* **Exclusividad del modelo**: Estos embeddings de alta dimensión solo funcionan con el modelo específico que los generó (Jina en este caso)

**Principio de cálculo**: Los factores de overhead se mantienen proporcionales - un vector de 2048d ocupará aproximadamente el doble que uno de 1024d, más el overhead estructural de DuckDB.

**Ejemplo de proyección para 2048d:**
Aplicando el factor promedio de 2.8x, un vector de 2048d tendría aproximadamente:

* Tamaño teórico: \~13.3 KB/chunk
* Tamaño real estimado: \~37 KB/chunk
* Para 2.7M chunks: \~100 GB (versus 66.24 GB para 1024d)

## Conclusiones

### Hallazgos Principales

El análisis empírico de almacenamiento para sistemas RAG revela insights fundamentales:

1. **Overhead consistente**: Los factores de overhead se mantienen entre 2.7x-3.1x independientemente de la dimensión del embedding, indicando que el costo adicional es principalmente estructural.
2. **Independencia del modelo**: Los patrones de almacenamiento son universales para una dimensión específica - el único factor variable es el tamaño del vector de embedding, no el modelo que lo genera.
3. **Escalabilidad lineal**: El crecimiento de almacenamiento es predecible y permite planificación de infraestructura precisa.
4. **Optimización concentrada**: El overhead estructural fijo de DuckDB significa que las optimizaciones de almacenamiento se enfocan primordialmente en la elección de dimensión del embedding.

### Decisión Arquitectónica para DOF-RAG

La selección de **768 dimensiones** para DOF-RAG se fundamenta en:

* **Eficiencia de almacenamiento**: 25% de ahorro respecto a 1024d
* **Calidad preservada**: Sin pérdida en la capacidad de respuesta del sistema
* **Escalabilidad**: Proyecciones sostenibles para volúmenes extensos de contenido histórico y futuro

### Metodología Replicable

Este análisis proporciona un marco metodológico replicable para evaluar decisiones de arquitectura en sistemas RAG, basado en mediciones empíricas de bases de datos reales con contenido del **DOF de enero 2025** (10,090 chunks).

**Bases de datos utilizadas:**

* `db_qwen_512.duckdb` - Embeddings 512 dimensiones (enero 2025)
* `db_qwen_768.duckdb` - Embeddings 768 dimensiones (enero 2025)
* `db_qwen_1024.duckdb` - Embeddings 1024 dimensiones (enero 2025)

**Limitaciones y escalabilidad:** Aunque el análisis se basó en un mes de datos debido a las limitaciones computacionales del proceso de generación de embeddings, los factores de overhead identificados son extrapolables a volúmenes mayores, ya que representan propiedades estructurales inherentes de DuckDB.

**Archivos de soporte y replicación:**

* [Script principal de análisis](https://github.com/CodeandoGuadalajara/dof-rag/blob/embedding-overhead-analysis/overhead_analysis/embedding_overhead_analysis.py) - Algoritmo completo de medición y cálculo
* [Datos completos del análisis](https://github.com/CodeandoGuadalajara/dof-rag/blob/embedding-overhead-analysis/overhead_analysis/embedding_overhead_analysis_results.json) - Resultados detallados en formato JSON
* [Script de verificación de bases de datos](https://github.com/CodeandoGuadalajara/dof-rag/blob/embedding-overhead-analysis/overhead_analysis/verify_databases.py) - Validación de consistencia de datos

**Metodología aplicable:** Los principios de medición pueden aplicarse a cualquier sistema RAG que utilice DuckDB como base de datos vectorial, independientemente del dominio de contenido o modelo de embedding utilizado.

El almacenamiento eficiente combinado con análisis empírico riguroso es fundamental para la toma de decisiones arquitectónicas en sistemas RAG de producción.
