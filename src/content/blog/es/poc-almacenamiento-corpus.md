---
title: "Guardar 31 GB de texto en 3 GB (y recuperar cada byte): la prueba de concepto de almacenamiento"
description: "Cuarta entrega del benchmark: construimos el corpus comprimido sobre 10,000 documentos reales. sqlite-zstd comprime 10.9x con acceso aleatorio, los chunks se guardan como recetas de 110 bytes en lugar de texto, el índice de búsqueda por palabras resultó 15x más chico de lo temido, y la cuantización TurboQuant empata en calidad con los vectores completos. Todo cabe en ~11 GB."
date: "2026-08-03"
heroImage: ""
category: "desarrollo"
tags: ["dof-rag", "almacenamiento", "sqlite", "zstd", "fts5", "vector-search", "benchmark"]
author: "Joaquín Bravo Contreras"
---

## Motivación

El [post anterior](/es/blog/2026/08/benchmark-hibrido-m3-gguf/) terminó con una decisión y una deuda. La decisión: búsqueda híbrida con jina-v5-text-small + BM25, fusión ponderada α=0.5. La deuda: demostrar que la [arquitectura de almacenamiento](https://github.com/CodeandoGuadalajara/dof-rag/blob/main/docs/corpus-storage-architecture.md) funciona de verdad.

Recordemos el problema. El corpus son 657,867 archivos Markdown, 31.47 GiB de texto. Una matriz de vectores fp32 para los ~5 millones de chunks son otros 20.8 GiB. Si además guardamos el texto de cada chunk junto a su vector (como hace la mayoría de los demos de RAG), son 33–40 GiB más. La laptop donde corre el proyecto tiene 19 GB libres. Las cuentas no dan, y sin embargo queremos un sistema completo: texto, búsqueda por palabras (BM25) y búsqueda por vectores.

La arquitectura propone tres ideas: guardar el texto una sola vez comprimido con zstd, guardar los chunks como *referencias* dentro de los documentos en vez de copiar el texto, y cuantizar los vectores. Este post cuenta la prueba de concepto (PoC) sobre 10,000 documentos reales elegidos al azar, con criterios de aceptación medibles definidos de antemano. Código y números completos en el PR [#61](https://github.com/CodeandoGuadalajara/dof-rag/pull/61) y en `docs/corpus-storage-poc-results.md`.

## Idea 1: comprimir el corpus, pero con acceso aleatorio

Comprimir 31 GB de texto no es lo difícil; lo difícil es comprimir y poder leer *un* documento en milisegundos sin descomprimir todo. Un archivo `.tar.zst` comprime muy bien pero hay que recorrerlo completo para sacar un archivo.

[sqlite-zstd](https://github.com/phiresky/sqlite-zstd) resuelve esto: cada renglón (documento) se comprime individualmente con [Zstandard](https://facebook.github.io/zstd/), así que leer un documento solo descomprime ese documento. El truco adicional son los **diccionarios**: zstd puede entrenar un diccionario con los patrones repetidos de un conjunto de textos y usarlo al comprimir cada renglón. El DOF es el caso ideal para diccionarios porque comparte formulas repetidas en todos los documentos:

```
Al margen un sello con el Escudo Nacional, que dice:
Estados Unidos Mexicanos.- Secretaría de ...
```

Ese encabezado (y decenas de variantes de rubricas, avisos y formatos de fechas) aparece en cientos de miles de documentos. Sin diccionario, cada documento pagaría por comprimirlo; con diccionario, se comprime a unos cuantos bytes de referencia. Entrenamos un diccionario por año de publicación.

El modo "transparente" de sqlite-zstd convierte la tabla en una vista: la aplicación hace `SELECT markdown FROM documents WHERE ...` y recibe texto plano, sin saber que abajo hay blobs comprimidos. Eso nos deja construir todo lo demás (índices, búsqueda de texto) como si fuera una base normal.

### Resultado

| Nivel zstd | Base de datos | Compresión | Tiempo de mantenimiento |
|---|---:|---:|---:|
| 3 (rápido) | 43.9 MiB | **10.92x** | 11 s |
| 19 (máximo) | 35.5 MiB | **13.51x** | 47 s |

Los 479.8 MiB de la muestra caben en 44 MiB. Extrapolado al corpus completo: **2.3–2.9 GiB**, en el extremo bajo del rango 2–8 GiB que estimaba la arquitectura. El criterio de aceptación pedía al menos 8x.

¿Y la lectura? El criterio pedía p95 menor a 50 ms para leer y descomprimir un documento. Medimos **0.15 ms** p95 sobre 500 lecturas aleatorias: trescientas veces más rápido que el objetivo. La descompresión zstd a nivel renglón no es un cuello de botella, ni de cerca.

La verificación importante no es la velocidad sino la exactitud: leímos los 10,000 documentos desde la base comprimida y comparamos el sha256 de cada uno contra el archivo original. **10,000 de 10,000 idénticos**, incluido un documento de 71.5 MiB que guardamos segmentado (los documentos mayores a 32 MiB se dividen en segmentos ordenados para no descomprimir gigantes completos en memoria).

## Idea 2: chunks sin texto — recetas de 110 bytes

Aquí está la parte más interesante del diseño. Un chunk de 800 tokens son ~2.5 KB de texto. Con 5 millones de chunks, guardar el texto de cada uno duplica el corpus. La arquitectura dice: guarda solo *offsets* (inicio, fin) dentro del documento, y en tiempo de consulta corta el texto.

El problema es que nuestro [chunker](/es/blog/2026/08/chunker-patron-dof/) no corta el documento en rebanadas limpias. Antes de chunkear, transforma el texto:

1. Convierte los comentarios `<!-- IMAGE_DESCRIPTION: ... -->` en párrafos de texto.
2. Elimina encabezados boilerplate (`## Al margen un sello...`).
3. Al dividir una sección larga, le antepone el encabezado a cada parte: `## SENTENCIA ...\n\n` + la parte correspondiente.
4. Une párrafos con separadores sintéticos y repite ~50 tokens de solape entre chunks consecutivos.

Así que un chunk **no es una subcadena del documento**: es un ensamblado de pedazos del documento con textito sintético intercalado. Un offset (inicio, fin) simple no alcanza.

La solución: en vez de un par de offsets, cada chunk guarda una **receta**: una lista de rebanadas del texto normalizado intercaladas con literales cortos. Ejemplo real simplificado:

```json
[[66, 261], {"l": "\n"}, [262, 2891]]
```

Se lee así: toma los caracteres 66–261 del texto normalizado (el encabezado de la sección), agrega un literal `"\n"` (el separador extra que el chunker inserta), y luego los caracteres 262–2891 (el contenido de la parte). Concatenado, es exactamente el texto del chunk.

"Texto normalizado" es el texto del documento después de aplicar las transformaciones deterministas del paso 1 y 2 — las mismas que el chunker aplica antes de chunkear. En tiempo de consulta se recalcula en memoria (una pasada de regex, ~0.4 ms) y nunca se guarda en disco.

### Lo que costó alinear esto

Generar la receta de un chunk es un problema de alineamiento: encontrar de qué rebanadas del texto normalizado salió cada pedazo del chunk. Suena fácil hasta que aparece el texto legal mexicano: las sentencias agrarias repiten párrafos enteros palabra por palabra ("...se concedió en vía de dotación de ejido, al poblado...") en decenas de secciones del mismo documento, y las tablas repiten renglones casi idénticos. Un alineador ingenuo ancla en la copia equivocada y se descarrila.

La solución combinó tres reglas: buscar cada chunk dentro de su *sección* (los encabezados H2 delimitan el territorio y la repetición entre secciones deja de estorbar), anclas que no crucen saltos de línea (los separadores entre renglones son sintéticos), y una regla de proximidad por niveles (un candidato a 2 KB del cursor necesita coincidir poco; uno lejano necesita coincidir mucho).

Resultado: el 98.7% de los 101,351 chunks quedaron como recetas puras de **110 bytes en promedio** (vs ~2.5 KB de texto). El 1.31% restante — compuestos de sentencias casi idénticas donde el alineamiento es genuinamente ambiguo — guarda su texto literal dentro de la receta. La reconstrucción es exacta en ambos casos: cada receta se verifica contra el sha256 del chunk al construir y al leer.

La prueba de extremo a extremo: tomar 500 chunks al azar, simular el camino de consulta completo (traer el documento de la base comprimida, descomprimir, normalizar, aplicar la receta) y verificar el hash: **500/500 correctos, p95 de 6.4 ms** por chunk. Guardar el texto de los chunks hubiera costado ~250 MB para la muestra; las recetas cuestan 10.7 MB.

## Idea 3: el índice de palabras salió 15 veces más chico de lo temido

Para BM25 usamos FTS5, el motor de búsqueda de texto de SQLite, en modo *external content*: el índice guarda solo las posiciones de cada palabra (postings), no el texto — el texto vive en la tabla comprimida y FTS lo consulta cuando lo necesita. Eso sí, hay un detalle técnico: como la compresión transparente convierte la tabla en vista, y las vistas no tienen `rowid`, hay que declarar el identificador explícitamente (`content_rowid='document_id'`) al crear el índice.

El número que faltaba por medir era el tamaño de este índice. Una medición anterior con un FTS *con contenido* (que sí duplica el texto) había dado 1.36 veces el tamaño del texto — si eso se hubiera repetido, el índice solo habría costado ~43 GiB y el diseño entero se caía.

Resultado real con external content: **43.2 MiB para 479.8 MiB de texto, o sea 0.09x**. Quince veces menos que la medición anterior. La diferencia se explica porque el índice solo guarda postings, y el vocabulario del DOF está dominado por boilerplate compartido: una vez indexado "Escudo Nacional" las primeras mil veces, las siguientes cien mil son entradas baratas en una lista que ya existe. Extrapolado: ~2.8 GiB para el corpus completo.

El índice se construye en 4 segundos sobre la vista comprimida y las consultas BM25 (incluyendo `snippet()` para mostrar fragmentos con contexto) funcionan sin tocar el pipeline de descompresión manualmente.

## Idea 4: vectores de 4 bits que recuperan igual que los de 32

La cuantización convierte cada dimensión del vector de 32 bits a 4, 3 o 2 bits. A 4 bits, un vector de 1,024 dimensiones pasa de 4,096 a **524 bytes** (7.8x menos). La pregunta obligada: ¿cuánta calidad se pierde?

Medimos con [sqlite-vector](https://github.com/sqliteai/sqlite-vector), una extensión de SQLite con escaneo SIMD y cuantización TurboQuant 2/3/4 bits, usando los embeddings reales del benchmark (8,065 chunks, 3,023 preguntas, ground truth = fp32 exacto):

| Modo | Recall@10 | Recall@50 | ms/query | Bytes/vector |
|---|---:|---:|---:|---:|
| Escaneo exacto | 0.992 | 0.997 | 8.7 | 4,096 |
| TurboQuant 4-bit | 0.953 | 0.966 | 2.1 | 524 |
| TurboQuant 3-bit | 0.924 | 0.939 | 3.8 | 396 |
| TurboQuant 2-bit | 0.866 | 0.890 | 0.8 | 268 |

Puro, el 4-bit pierde ~4 puntos de recall. Eso podría doler, excepto que el sistema de producción no usa los vectores puros: usa la fusión con BM25. Y ahí pasó lo mismo que en el post anterior con la cuantización binaria, pero más fuerte. La tabla de MRR con fusión ponderada α=0.5, medida con la extensión real (no una simulación en numpy):

| Sistema (α=0.5) | MRR | Recall@1 |
|---|---:|---:|
| **jina TurboQuant4** | **0.656** | 0.581 |
| jina fp32 | 0.656 | 0.584 |
| jina TurboQuant3 | 0.654 | 0.579 |
| jina binary (plan anterior) | 0.649 | 0.574 |
| F2LLM-int8 (opción calidad) | 0.662 | 0.594 |

**Empate exacto con fp32.** La fusión absorbe por completo la pérdida de la cuantización: cuando TurboQuant equivoca el orden de un candidato, BM25 casi siempre lo tiene bien ordenado, y viceversa. Además supera al plan anterior (vectores binarios con sqlite-vec, 0.649), así que TurboQuant4 pasa a ser la opción por defecto: mismo espacio que binary aproximadamente, mejor calidad, y una extensión mantenida activamente.

Extrapolado a ~5.1 millones de chunks: **~2.5 GiB** de vectores y ~1.3 segundos por consulta de escaneo completo — aceptable para el volumen de usuarios inicial; si la latencia importa más adelante, la arquitectura ya contempla motores ANN (pgvector, LanceDB, Qdrant).

## La cuenta final

| Componente | Estimación corpus completo | Base de la estimación |
|---|---:|---|
| Corpus comprimido | 2.3–2.9 GiB | 13.51x / 10.92x medidos |
| Índice FTS5 (BM25 documento) | ~2.8 GiB | 0.09x texto medido |
| Metadata y recetas de chunks | ~2.8 GiB | 43 MiB por 10k docs |
| Vectores TurboQuant4 | ~2.5 GiB | 524 B × 5.1M |
| **Total** | **~11 GiB** | |

Contra ~75 GiB del diseño ingenuo (texto + texto de chunks + vectores fp32), y cabe en los 19 GB libres de la laptop con margen para el índice de producción y las bases de respaldo.

## Lo que aprendimos por el camino

- **sqlite-zstd no publica binarios para macOS ARM**, así que lo compilamos localmente (23 segundos con el toolchain de Rust vía mise). Hizo falta un parche mínimo: la extensión valida que la versión de SQLite en tiempo de ejecución sea al menos la de sus encabezados (3.49), pero el Python del proyecto enlaza SQLite 3.47. Bajamos el piso de la validación a 3.34, que es lo que el código realmente necesita.
- `PRAGMA auto_vacuum=FULL` hay que declararlo *antes* de cambiar a modo WAL; al revés, SQLite lo ignora en silencio.
- El entrenamiento de diccionarios de zstd falla con pocos renglones enormes (los segmentos de 25 MiB del documento gigante). Solución documentada: `'[nodict]'` para esa tabla — con 3 renglones un diccionario tampoco aportaba nada.
- La ingesta es reanudable de verdad: matamos el proceso con `kill -9` a mitad de la compresión y al relanzar continuó sin perder ni corromper nada (cada documento se inserta por ruta única, en transacciones de 256).

## Advertencias y siguientes pasos

Dos licencias requieren revisión antes de producción: sqlite-vector usa una variante de Elastic License 2.0 (el proyecto es MIT, lo que aparentemente satisface la cláusula de código abierto, pero hay que revisarlo para uso en servicio) y sqlite-zstd es LGPL-3.0. Además el propio autor de sqlite-zstd advierte no confiar en él sin respaldos — el árbol de Markdown original sigue siendo la fuente de verdad; la base SQLite es un artefacto derivado que se puede reconstruir.

Lo que sigue:

1. **Construcción del corpus completo**: 657,867 documentos con este mismo pipeline (la muestra de 10k tardó ~6 minutos de ingesta + chunking; escalar es cuestión de horas, no de días).
2. **Indexación de embeddings**: ~14 días de cómputo continuo con el servidor GGUF/Metal del post anterior, ya con los prefijos `Document: `/`Query: ` que jina necesita.
3. Revisión de licencias y, si el volumen de usuarios lo justifica, el prototipo PostgreSQL + pgvector que la arquitectura deja como ruta B.
