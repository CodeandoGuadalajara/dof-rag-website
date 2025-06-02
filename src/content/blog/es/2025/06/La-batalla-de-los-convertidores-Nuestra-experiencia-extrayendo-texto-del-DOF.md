---
title: 'La batalla de los convertidores: Nuestra experiencia extrayendo texto del DOF'
date: 2025-06-01T06:00:00.000Z
author: Equipo DOF-RAG
description: >-
  Un análisis comparativo de las diferentes herramientas para convertir PDFs a
  markdown y por qué elegimos Marker para nuestro proyecto DOF-RAG.
image: /images/posts/2025/06/92f286c0-7081-44b9-9ccc-94d53d3daf09.png
tags:
  - conversión de documentos
  - DOF-RAG
  - extracción de texto
  - Markdown
  - PDF
featured: true
---

# La batalla de los convertidores: PDF vs. Markdown

Si alguna vez has intentado extraer información estructurada de un PDF, probablemente conoces ese sentimiento... ese momento exacto en que te das cuenta de que has entrado en un laberinto del que no será fácil salir.

En nuestro proyecto, donde procesamos documentos del Diario Oficial de la Federación (sí, esos documentos legales extensos que pocos leen pero que afectan a millones), nos enfrentamos al desafío monumental de convertir miles de páginas de PDF a un formato que los modelos de IA pudieran digerir sin sufrir una indigestión digital.

## El desafío: No todos los PDFs nacen iguales

Los documentos del DOF no son precisamente PDFs simples. Estamos hablando de archivos con:

* Tablas complejas con múltiples niveles y formatos diversos
* Imágenes y gráficos intercalados en diferentes secciones
* Múltiples columnas que dificultan la lectura automática
* Notas al pie que aparecen en lugares inesperados
* Y por si fuera poco, una estructura jerárquica de títulos muy elaborada

Convertir todo esto a markdown manteniendo la estructura, el formato y la integridad de la información es como intentar traducir poesía: siempre se pierde algo en el proceso.

## Las herramientas en contienda: Nuestra comparativa de convertidores

Decidimos probar varias herramientas para ver cuál se adaptaba mejor a nuestras necesidades. Aquí está nuestro análisis después de enfrentarlas a un documento de 402 páginas:

| Herramienta      | Tiempo de procesamiento | Calidad (1-10) | Fortalezas                                                                          | Debilidades                                                          |
| ---------------- | ----------------------- | -------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Marker           | 1340 seg                | 8.5            | Extracción de imágenes (90% precisión), metadata en JSON, buenas tablas, paginación | Problemas ocasionales con jerarquía                                  |
| Marker w/ Gemini | 3748 seg                | 8              | Similar a Marker pero con procesamiento asistido por IA                             | Tiempo excesivo, sin mejoras significativas                          |
| Docling          | 2338 seg                | 8              | Calidad similar a Marker                                                            | Sin extracción de imágenes, fallos en algunas tablas, sin paginación |
| Gemini           | 2792 seg                | 9              | Excelente conversión de listas, negritas y tablas                                   | Sin extracción de imágenes, tiempo excesivo                          |
| PyMuPDF          | 6 seg                   | 2              | Extremadamente rápido, buena extracción de imágenes                                 | No reconoce títulos ni jerarquía, resultado apenas utilizable        |
| pymupdf4llm      | 77 seg                  | 8              | Rápido, calidad similar a Marker                                                    | Sin extracción de imágenes, sin paginación                           |

> **Nota**: Todas las pruebas se realizaron en una laptop con Intel Core i5-11300H (3.10 GHz), 16GB RAM, Windows 11 Pro y NVIDIA GeForce GTX 1651.

## ¿Y el ganador es...?

Después de este análisis detallado, elegimos **Marker** como nuestra herramienta principal. Fue como elegir entre varios platos con ingredientes similares pero con diferentes tiempos de preparación y presentación.

¿Por qué Marker? Básicamente por el equilibrio entre:

* **Velocidad razonable**: No es el más rápido, pero tampoco nos hizo envejecer esperando
* **Buena calidad de extracción**: Mantiene la estructura del documento original en la mayoría de los casos
* **Extracción de imágenes**: Porque las imágenes también contienen información valiosa
* **Paginación**: Fundamental para mantener referencias al documento original

## No todo es color de rosa: Las limitaciones de Marker

Como toda relación a largo plazo, nuestra historia con Marker tiene sus altibajos. Después de procesar bastantes documentos, hemos identificado algunos problemas:

* **Jerarquía confusa**: A veces confunde los niveles de títulos, convirtiendo lo que debería ser un H2 en un H3, o viceversa. Es como si de repente los niveles de organización se mezclaran entre sí.
* **Exceso de etiquetas `<br>`**: En documentos con muchas tablas, Marker puede generar una cantidad excesiva de etiquetas `<br>` que hacen que el código resultante sea difícil de leer y procesar.
* **Tablas complejas**: Aunque maneja bien las tablas simples, cuando se enfrenta a tablas fusionadas o con formatos especiales, el resultado puede alejarse bastante de la estructura original.
* **Tiempo de procesamiento**: No es precisamente un rayo, especialmente con documentos extensos. Procesar el documento de prueba de 402 páginas tomó más de 22 minutos, tiempo suficiente para preparar y disfrutar una taza de café... o tres.

## ¿Qué hemos aprendido?

Después de esta experiencia con diferentes herramientas, podemos compartir algunas lecciones:

1. **No existe la herramienta perfecta**: Cada una tiene sus fortalezas y debilidades, y la elección depende de tus prioridades específicas.
2. **La velocidad tiene un costo**: PyMuPDF es increíblemente rápido (6 segundos vs. 1340 de Marker), pero la calidad es tan baja que los resultados apenas son utilizables.
3. **La IA no siempre es la respuesta**: Integrar Gemini en el proceso triplicó el tiempo sin una mejora proporcional en la calidad.
4. **Post-procesamiento es inevitable**: Independientemente de la herramienta elegida, siempre necesitarás algún tipo de limpieza o ajuste posterior.

## Herramientas en nuestro radar: Lo que viene en el horizonte

Aunque por ahora nos hemos decidido por Marker, el mundo de la extracción de texto de PDFs sigue evolucionando. Estas son dos herramientas prometedoras que tenemos en la mira para futuras evaluaciones:

### MinerU (OpenDataLab)

MinerU es una herramienta de código abierto que ha captado nuestra atención por su enfoque especializado en la conversión de documentos científicos a formatos como Markdown y JSON.

Lo que nos interesa:

* La integración con PDF-Extract-Kit para mejorar la detección de diseño y OCR

[Repositorio de MinerU](https://github.com/opendatalab/MinerU)

### MarkItDown (Microsoft)

Desarrollada por Microsoft, esta utilidad en Python está ganando popularidad rápidamente y ofrece compatibilidad con una amplia gama de formatos, incluyendo documentos de Office y PDFs.

Lo que nos llama la atención:

* Sistema de plugins extensible: Permite añadir funcionalidades personalizadas o utilizar plugins de terceros para casos de uso específicos
* Su optimización específica para modelos de lenguaje, con salidas eficientes en tokens
* Soporte para múltiples formatos más allá de PDF (DOCX, XLSX, HTML, etc.)

[Repositorio de MarkItDown](https://github.com/microsoft/markitdown)

## Conclusión: Navegando en el océano de los convertidores

En el universo de la conversión de PDF a markdown, no hay balas de plata. Nuestra elección de Marker representa un compromiso entre calidad, tiempo y características, pero seguimos experimentando y mejorando nuestro pipeline.

La extracción y procesamiento de documentos es solo el primer paso en nuestro proyecto DOF-RAG. Una vez convertidos a markdown, estos documentos pasan por un proceso de chunking (fragmentación), vectorización y finalmente se integran en nuestro sistema de recuperación aumentada por generación (RAG) para proporcionar respuestas precisas a consultas sobre el contenido del DOF.

***

¿Conoces una mejor herramienta para la extracción de texto que deberíamos probar? ¿Tienes trucos para mejorar los resultados de Marker u otras librerías? ¡Comparte tu experiencia en la caja de comentarios!

*Este post forma parte de nuestro proyecto DOF-RAG para el procesamiento y consulta inteligente de documentos del Diario Oficial de la Federación. Para más información sobre la arquitectura completa, los componentes del sistema y los avances del proyecto, te invitamos a visitar nuestro [repositorio en GitHub](https://github.com/CodeandoGuadalajara/dof-rag) y unirte a nuestra comunidad.*
