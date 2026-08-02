---
title: "Búsqueda híbrida: cómo juntar BM25 y embeddings (y hacerlos caber en una laptop)"
description: "Tercera entrega del benchmark: fusionamos los rankings de BM25 y embeddings y el resultado supera a ambos por separado. También medimos cómo indexar el corpus completo desde la Mac M3: qué sirve (GGUF/Metal), qué no (batches grandes, fp16), y por qué la cuantización binaria de jina decide la arquitectura de almacenamiento."
date: "2026-08-02"
heroImage: ""
category: "desarrollo"
tags: ["dof-rag", "embeddings", "benchmark", "bm25", "hybrid-retrieval", "gguf", "apple-silicon"]
author: "Joaquín Bravo Contreras"
---

## Motivación

El [benchmark anterior](/es/blog/2026/08/benchmark-embeddings-ronda2-bm25/) terminó con una conclusión incómoda y una tarea pendiente.

La conclusión incómoda: BM25 (búsqueda por palabras exactas) y los embeddings (búsqueda por significado) ganan en tipos de pregunta distintos. Si alguien pregunta "¿Qué establece el artículo 5 del Decreto 317?", BM25 gana porque esas palabras aparecen literalmente en el documento. Si alguien pregunta "¿Cuánto ganan los altos funcionarios de la CNDH?", los embeddings ganan porque el documento habla de "MANUAL de percepciones de servidores públicos de mando" y BM25 no encuentra esas palabras en la pregunta. Un sistema que solo use uno de los dos va a fallar en la mitad de las preguntas que le haga un ciudadano.

La tarea pendiente: indexar el corpus completo (~6.5 millones de chunks) tomaría entre 20 y 44 días de cómputo continuo en la Mac M3 con la configuración que usamos en el benchmark. Antes de comprometer semanas de cómputo había que revisar si ese tiempo se podía reducir.

Este post cuenta cómo resolvimos ambas cosas. La respuesta corta: fusionar los dos rankings da un sistema mejor que cualquiera de los dos por separado, y un puerto a GGUF/Metal casi duplica la velocidad de embedding en la M3. Código y reportes en el PR [#59](https://github.com/CodeandoGuadalajara/dof-rag/pull/59).

## ¿Qué es fusionar rankings?

Los dos sistemas responden una pregunta devolviendo una lista ordenada de resultados: BM25 ordena por coincidencia de palabras, los embeddings por similitud semántica. Fusionar significa tomar las dos listas y producir una sola lista combinada. Hay dos formas estándar de hacerlo:

- **RRF** (Reciprocal Rank Fusion): ignora los puntajes y solo usa las posiciones. Si un chunk aparece en el lugar 2 de BM25 y en el 7 de vectores, suma puntos por ambas posiciones. Es simple y no requiere calibrar nada.
- **Weighted**: convierte los puntajes de cada sistema a una escala común (0 a 1 por pregunta) y los combina con un peso α: `α × puntaje_BM25 + (1−α) × puntaje_vectores`. Con α=0.5 ambos sistemas pesan igual; con α=0.75 BM25 pesa el triple.

Evaluamos ambos métodos sobre el mismo query set de la ronda anterior: 499 documentos, 8,065 chunks y 3,023 preguntas de 6 tipos, con ground truth conocido. El script es [`evaluate_hybrid.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/evaluate_hybrid.py); los embeddings quedan cacheados en disco, así que probar una combinación nueva de fusión toma minutos.

## Resultado: la fusión gana

| Sistema | MRR | Recall@1 | Recall@5 |
|---|---|---|---|
| BM25 solo | 0.616 | 0.561 | 0.687 |
| F2LLM-0.6B int8 solo | 0.561 | 0.496 | 0.646 |
| jina-v5-small binary solo | 0.538 | 0.470 | 0.631 |
| RRF(BM25, F2LLM-int8) | 0.633 | 0.572 | 0.712 |
| **W0.50(BM25, F2LLM-int8)** | **0.661** | **0.596** | **0.749** |
| W0.50(BM25, jina-binary) | 0.646 | 0.573 | 0.744 |

Leyendo la tabla en términos prácticos: de cada 100 preguntas, BM25 solo encuentra el documento correcto en primer lugar 56 veces. El mejor embedding solo, 50 veces. La fusión con pesos iguales, **60 veces**, y dentro del top 5 encuentra el documento 75 veces de 100, contra 69 de BM25. Son 4 a 10 puntos porcentuales de mejora dependiendo de la métrica, sin cambiar ni el modelo ni el índice, solo por combinar dos listas que ya teníamos.

RRF también mejora sobre ambos padres, pero queda unos 3 puntos debajo de la fusión ponderada. Y la curva de α es plana entre 0.5 y 0.6, así que no hace falta calibrar el peso con mucha precisión.

### La perilla α depende del tipo de pregunta

El desglose por tipo de query (Recall@1) muestra algo más interesante que el promedio:

| Tipo de pregunta | BM25 | F2LLM int8 | W0.25 | W0.50 | W0.75 |
|---|---|---|---|---|---|
| factual (términos del doc) | 0.703 | 0.469 | 0.527 | 0.659 | 0.708 |
| paraphrase (reformulada) | 0.565 | 0.773 | **0.813** | 0.783 | 0.645 |
| thematic (lenguaje ciudadano) | 0.301 | 0.446 | **0.492** | 0.450 | 0.354 |

Para preguntas que usan las mismas palabras del documento (`factual`), conviene α=0.75: darle más peso a BM25. Para preguntas reformuladas o en lenguaje ciudadano (`paraphrase`, `thematic`), conviene α=0.25: darle más peso a los vectores. Y en `paraphrase` pasa algo notable: la fusión con α=0.25 (0.813) supera a *los dos* sistemas por separado (0.773 y 0.565). No solo reparte lo mejor de cada uno; la combinación encuentra documentos que ninguno de los dos encontraba solo.

Un α fijo de 0.5 es un buen compromiso, pero deja entre 2 y 4 puntos de MRR sobre la mesa. Recuperarlos requiere decidir el peso por pregunta, lo cual apunta directo al sistema agéntico del post anterior: un LLM que clasifique la pregunta ("¿esto busca un término exacto o un tema?") y ajuste la fusión, o que llame a cada herramienta de búsqueda según corresponda.

### La cuantización sobrevive a la fusión

Dos datos que ya veníamos confirmando, ahora en el contexto híbrido:

- **int8 sigue siendo gratis**: los resultados de F2LLM-int8 son idénticos a fp32 en todas las métricas. Cuarta confirmación en este proyecto.
- **binary pierde menos en fusión que solo**: jina-binary pierde ~2 puntos de MRR cuando se usa solo, pero solo ~1 punto dentro de la fusión (0.650 vs 0.662 de F2LLM-int8). BM25 compensa justo los casos donde la binarización degrada al embedding.

## Indexar 6.5 millones de chunks desde una laptop

### Lo que no funcionó: afinar PyTorch

Las velocidades del benchmark anterior salieron de la configuración default de sentence-transformers (batch 32, fp32). Probamos si había margen con un sweep de batch size (32 a 256) y fp16 en [`scripts/bench_throughput.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/bench_throughput.py). No había margen: el default ya era óptimo, batches más grandes *empeoran* el throughput (los chunks del DOF son largos y la memoria aprieta), y fp16 es numéricamente idéntico pero igual de lento. PyTorch MPS ya estaba al límite.

### Lo que sí funcionó: GGUF sobre Metal

llama.cpp es un motor de inferencia en C++ con backend nativo para el GPU de Apple (Metal), distinto de PyTorch. Los modelos se convierten a un formato llamado GGUF, que para nuestros dos candidatos ya existe: `mradermacher/F2LLM-v2-0.6B-GGUF` y los GGUF oficiales de jina. Medimos con [`scripts/bench_gguf.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/bench_gguf.py), que levanta `llama-server` en modo embedding y le manda los mismos 1,378 chunks del sweep anterior:

| Modelo | PyTorch MPS | GGUF/Metal | Ganancia |
|---|---|---|---|
| F2LLM-v2-0.6B | 3.74 chunks/s | 5.34 chunks/s | 1.43× |
| jina-v5-small | 2.93 chunks/s | 5.42 chunks/s | 1.85× |

Cuantizar los pesos del modelo a Q8 no dio más velocidad (el límite es el cómputo, no la memoria), así que usamos f16. Con estos números, la indexación del corpus completo baja de 20–27 días a **~14 días continuos por modelo** en la laptop. Sigue sin ser trivial, pero ya es un trabajo que se puede dejar corriendo; la alternativa de rentar un GPU en la nube queda disponible si queremos el índice en horas.

### El prefijo que casi arruina el índice silenciosamente

Antes de confiar en los embeddings de llama.cpp verificamos que fueran equivalentes a los de sentence-transformers. F2LLM salió perfecto (similitud de coseno 0.9993). Jina salió mal: 0.958 de promedio, con casos en 0.75. Si hubiéramos indexado así, la búsqueda se habría degradado sin que ningún error lo anunciara.

La causa: sentence-transformers, sin avisar mucho, le antepone el texto `Document: ` a cada chunk y `Query: ` a cada pregunta cuando usa jina-v5 (así viene en la configuración del modelo). llama.cpp no sabe nada de eso y embeddea el texto tal cual. Al agregar los prefijos manualmente, el acuerdo subió a 0.9999. La lección quedó documentada en el reporte: al indexar con el servidor GGUF, los chunks deben llevar `Document: ` y las queries `Query: `.

## La decisión: jina binary, y por qué cambia la arquitectura

Con los experimentos anteriores sobre la mesa, la configuración de producción para la primera indexación completa es:

**jina-v5-text-small con vectores binarios + BM25, fusión weighted α=0.5.**

El razonamiento ya no es solo de calidad (0.650 de MRR, 1.5 puntos abajo de F2LLM-int8), sino de espacio en disco. La [arquitectura de almacenamiento del corpus](https://github.com/CodeandoGuadalajara/dof-rag/blob/main/docs/corpus-storage-architecture.md) guarda el texto de los documentos una sola vez, comprimido con zstd, y los chunks como *referencias* (offsets) dentro de esos documentos en lugar de copiar el texto otra vez. Con ese diseño, el desglose para el corpus completo queda:

| Componente | Tamaño estimado |
|---|---|
| Corpus comprimido (zstd) | 2–8 GB |
| Metadata de chunks (offsets, sin texto) | 1–2 GB |
| Vectores jina binary (6.5M × 128 bytes) | **0.83 GB** |
| Vectores F2LLM int8 (alternativa) | 6.7 GB |

Los vectores binarios de jina ocupan un octavo de los int8 y, medido en la fusión, cuestan solo 1.5 puntos de MRR. Eso es lo que hace que el índice completo quepa cómodamente en el disco de la laptop (que hoy tiene 19 GB libres) y después en un servidor modesto.

Una última validación: la arquitectura propone hacer BM25 a nivel *documento* (sobre el texto comprimido) en lugar de a nivel chunk como hicimos en el benchmark. Repetimos la evaluación de fusión con esa granularidad ([`evaluate_hybrid_doclevel.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/evaluate_hybrid_doclevel.py)) y el resultado se mantiene: MRR 0.650 con jina-binary, 0.662 con F2LLM-int8. BM25 a nivel documento es más débil por sí solo (0.589), porque los documentos largos diluyen el puntaje de las palabras, pero la fusión compensa la diferencia por completo. El diseño que cabe en el disco no cuesta calidad.

## Siguientes pasos

1. **Proof of concept de almacenamiento**: construir el corpus comprimido con sqlite-zstd sobre 10,000 documentos, siguiendo los criterios de aceptación de la arquitectura (compresión ≥8×, reconstrucción exacta de chunks desde offsets, FTS5 funcionando sobre la vista comprimida, ingesta reanudable). Ahí mediremos también el tamaño real del índice FTS, el único número que falta por estimar.
2. **Indexación completa**: con el PoC validado, correr el embedder GGUF sobre los 657,867 documentos (~14 días, con checkpoints para reanudar).
3. **Peso adaptativo y agente**: usar la perilla α por tipo de pregunta y las herramientas de metadata (fecha, tipo, emisor) descritas en el post anterior.

## Código y datos

- PR: [#59](https://github.com/CodeandoGuadalajara/dof-rag/pull/59)
- Scripts: [`bench_throughput.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/bench_throughput.py), [`bench_gguf.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/bench_gguf.py), [`evaluate_hybrid.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/evaluate_hybrid.py), [`evaluate_hybrid_doclevel.py`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/scripts/evaluate_hybrid_doclevel.py)
- Reportes: [`reports/bench_throughput.md`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/reports/bench_throughput.md), [`reports/hybrid_retrieval.md`](https://github.com/jackbravo/dof-rag/blob/feat/hybrid-retrieval-m3-gguf/reports/hybrid_retrieval.md)
