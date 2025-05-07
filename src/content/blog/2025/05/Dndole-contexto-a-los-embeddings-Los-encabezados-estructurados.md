---
title: 'Dándole contexto a los embeddings: Los encabezados estructurados'
date: 2025-05-06T06:00:00.000Z
author: Equipo DOF-RAG
description: >-
  Cómo resolvimos el problema de la falta de contexto en chunks de texto para
  mejorar la precisión de nuestro sistema RAG.
image: '/images/posts/2025/05/ChatGPT Image 6 may 2025, 01_56_28 p.m..png'
tags:
  - NLP
  - chunks
  - embeddings
  - RAG
  - DOF-RAG
featured: true
---

# El problema del contexto perdido: cuando los chunks se quedan huérfanos

Imaginemos que estamos leyendo una novela, pero alguien arrancó todas las páginas y las barajó como una baraja de cartas. En cada página lees frases como: **"Él decidió que ya era suficiente"** o **"La situación empeoró considerablemente"**. ¿Quién es "él"? ¿Qué situación empeoró? Sin el contexto adecuado, estas frases son prácticamente inútiles/inservibles.

Pues bien, este es exactamente el problema al que nos enfrentamos con nuestro sistema RAG para el Diario Oficial de la Federación. Cuando dividimos los documentos en pequeños fragmentos (chunks) para procesarlos, estos perdían su contexto original, llevando a dos problemas críticos:

1. **Recuperación deficiente**: Chunks que deberían ser relevantes para una consulta no se recuperaban porque contenían pronombres en lugar de referencias explícitas.
2. **Alucinaciones**: El modelo recibía fragmentos descontextualizados y generaba respuestas incorrectas o inventadas.

## La solución: Contextual Chunk Headers

La idea es simple: añadir a cada chunk un encabezado que le proporcione el contexto necesario. Como poner una pequeña etiqueta a cada página suelta de nuestro libro que diga por ejemplo: "Capítulo 5: La traición de Juan".

Implementamos dos enfoques diferentes para resolver este problema:

### Enfoque 1: El método simplificado

primer intento fue crear encabezados con un formato plano:

```
Document: 01052025-DOF | Section: Título 1 > Subtítulo A > Apartado 3 | Page: 5
```

Este método concatenaba todos los encabezados encontrados en el chunk, separados por un símbolo ">", y añadía el número de página. Era como poner una miga de pan que mostrara la ruta desde el inicio del documento.

**Código simplificado:**

```python
def build_chunk_header(doc_title, heading_list):
    if not heading_list:
        return f"Document: {doc_title}"
    hierarchy_str = " > ".join(heading_list)
    return f"Document: {doc_title} | Section: {hierarchy_str}"
```

### Enfoque 2: Encabezados estructurados al rescate

Pero pronto nos dimos cuenta de que este enfoque plano no preservaba adecuadamente la jerarquía de los encabezados. Así que implementamos una solución más sofisticada: mantener un registro de los "encabezados abiertos" a medida que recorremos el documento, respetando su nivel jerárquico (H1, H2, H3, etc.).

**Código simplificado:**

```python
def build_header(doc_title, page, open_headings, chunk_number):
    header_lines = [f"# Document: {doc_title} | page: {page}"]
    
    for (lvl, txt) in open_headings:
        hashes = "#" * lvl
        header_lines.append(f"{hashes} {txt}")
        
    return "\n".join(header_lines)
```

El resultado es un encabezado que se parece más a la estructura real del documento:

```
# Document: 01052025-DOF | page: 5
## Título 1
### Subtítulo A
#### Apartado 3
```

## La diferencia entre los dos enfoques

Aunque ambos métodos buscan solucionar el mismo problema, sus diferencias son fundamentales:

| Característica           | Enfoque 1 (Plano)                            | Enfoque 2 (Estructurado)                                               |
| ------------------------ | -------------------------------------------- | ---------------------------------------------------------------------- |
| **Estructura**           | Lineal, concatenando títulos con separadores | Jerárquica, preservando niveles con sintaxis Markdown                  |
| **Memoria de contexto**  | Hereda solo el último encabezado             | Mantiene la estructura completa de "encabezados abiertos"              |
| **Representación**       | `Título > Subtítulo > Apartado`              | Formato multilinea con niveles `#`, `##`, `###`                        |
| **Manejo de niveles**    | Ignora la jerarquía de los encabezados       | Respeta y representa explícitamente la relación entre H1, H2, H3, etc. |
| **Tratamiento especial** | No diferencia entre fragmentos               | El primer fragmento recibe un tratamiento especial                     |

Esta diferencia es crucial porque:

1. **Para el modelo de embeddings**: La estructura jerárquica proporciona señales semánticas más ricas que ayudan al modelo a entender mejor las relaciones entre conceptos.
2. **Para la recuperación**: Los términos de búsqueda tienen más probabilidades de coincidir con la estructura explícita de los encabezados que con una cadena plana.
3. **Para el LLM**: Al generar respuestas, el modelo puede entender exactamente en qué nivel de la jerarquía se encuentra cada fragmento, lo que reduce ambigüedades y permite respuestas más precisas.

El enfoque estructurado, además, implementa una lógica sofisticada que detecta cuando un encabezado de nivel superior (como un H1) debe "reiniciar" el contexto, mientras que encabezados de nivel inferior se acumulan adecuadamente, manteniendo la coherencia documental incluso cuando los fragmentos están separados por múltiples páginas.

## Lecciones aprendidas

Esta experiencia nos enseñó algo importante: el contexto lo es todo. Podemos tener los mejores modelos de embedding y los LLMs más avanzados, pero si les damos información fragmentada y descontextualizada, obtendremos resultados mediocres.
Es como pedirle a alguien que resuelva un rompecabezas sin mostrarle la imagen completa. Podría intentarlo, pero probablemente colocará algunas piezas en lugares incorrectos.

## ¿Qué sigue?

En el ecosistema, siguen surgiendo métodos innovadores para resolver el problema de la pérdida de contexto. Estos son algunos enfoques prometedores que podrían complementar nuestra solución actual:

### Contextual Retrieval (Anthropic)

Esta técnica introduce dos subtécnicas que enriquecen la etapa de recuperación:

* **Contextual Embeddings**: Se genera automáticamente un texto contextual (50-100 tokens) para cada chunk mediante un LLM como Claude, describiendo brevemente su posición y contenido dentro del documento original.
* **Contextual BM25**: Además de los embeddings semánticos, se crea un índice BM25 sobre estos mismos chunks contextualizados para capturar coincidencias léxicas exactas.

Al combinar embeddings semánticos con BM25 léxico, Anthropic ha demostrado una reducción del 49% en la tasa de fallos de recuperación. Y si se añade un paso de reranking, esta mejora alcanza un impresionante 67%.

### Contextual Document Embeddings (CDE)

CDE implementa un sofisticado proceso en dos etapas:

1. **Primera fase**: Se selecciona un subconjunto representativo del corpus completo (denominado "minicorpus") y se calcula un embedding colectivo llamado `dataset embeddings`.
2. **Segunda fase**: Al generar embeddings de documentos individuales y consultas, el modelo condiciona sus representaciones en estos `dataset_embeddings`, integrando tokens de contexto que reflejan la distribución completa del corpus.

Este enfoque mejora significativamente la coherencia contextual de las búsquedas, incluso cuando no se conoce de antemano el corpus exacto sobre el que se realizarán las consultas.

### Late Chunking (Jina)

Este método revoluciona el proceso tradicional de chunking aprovechando modelos de embeddings de largo contexto (hasta 8,192 tokens):

1. Se aplica primero el transformador al texto completo o al máximo contexto posible, obteniendo embeddings token a token.
2. Posteriormente, se realiza pooling (promedio) **por fragmento**, generando chunks cuya representación vectorial ya incluye información semántica de todo el documento.

Este enfoque preserva relaciones a larga distancia y mejora significativamente métricas de recuperación como nDCG\@10 frente al método tradicional de chunking previo a la transformación.

Estas técnicas representan direcciones interesantes para la investigación y podrían ofrecer nuevas formas de mejorar los sistemas RAG. Quizás alguna de ellas, o una combinación, podría ser una evolución natural de nuestro trabajo.

*Este post forma parte de nuestro proyecto DOF-RAG para el procesamiento y consulta inteligente de documentos del Diario Oficial de la Federación. Para más información sobre la arquitectura completa, los componentes del sistema y los avances del proyecto, consulta nuestro [repositorio en GitHub](https://github.com/CodeandoGuadalajara/dof-rag).*
