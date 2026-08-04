---
title: "657,867 documentos después: el corpus completo en 3.5 GB, 6.7 millones de chunks, y los bugs que solo aparecen a escala real"
description: "Construimos las bases de producción sobre los 657,867 documentos del DOF: el corpus comprimido completo ocupa 3.52 GiB, el índice de chunks guarda 6.73 millones de recetas de 91 bytes, y el piloto de vectores binarios confirma que el índice vectorial cabrá en menos de 1 GiB. En el camino: un GROUP BY que consumió 35 GB de disco, un documento que se convertía en 21 GB de chunks, y una lección sobre paridad de resultados."
date: "2026-08-04"
heroImage: ""
category: "desarrollo"
tags: ["dof-rag", "almacenamiento", "sqlite", "zstd", "chunking", "vector-search", "embedding"]
author: "Joaquín Bravo Contreras"
---

## De la muestra al corpus completo

El [post anterior](/es/blog/2026/08/poc-almacenamiento-corpus/) cerró con una lista de pendientes: la prueba de concepto sobre 10,000 documentos había pasado todos sus criterios de aceptación, y quedaba construir las bases de producción sobre los 657,867 documentos del corpus. Eso es lo que hicimos. Este post cuenta qué funcionó igual que en la muestra, qué se rompió al escalar 65 veces, y por qué decidimos cambiar el plan de vectores en el camino. Código y números en el PR [#62](https://github.com/CodeandoGuadalajara/dof-rag/pull/62) y en `docs/full-corpus-build.md`.

Resultados primero:

| Componente | Resultado | Estimado previo |
|---|---:|---:|
| Corpus comprimido (zstd L3) | **3.52 GiB** (8.9x) | 2.9 GiB |
| Índice de chunks (recetas, sin texto) | **2.68 GiB**, 6,730,304 chunks | ~2.8 GiB |
| Vectores binarios (medido en piloto) | 151 B/vector | ~0.94 GiB total |
| Documentos verificados byte a byte | 300/300 contra el árbol original | — |
| Reconstrucción de chunks verificada | 500/500 hashes idénticos | — |

## Antes de construir: preparar el esquema para otras fuentes

Una conclusión del análisis previo: casi todo lo necesario para agregar fuentes no-DOF (la constitución, leyes estatales) es incremental, **excepto** un cambio de esquema que se vuelve más caro después. La tabla comprimida no admite `ALTER TABLE` (sqlite-zstd la convierte en vista; la migración es reconstruir), así que la columna `source` tenía que entrar ahora o nunca.

Dos detalles de diseño que vale la pena explicar:

- **Diccionarios por fuente y año.** sqlite-zstd decide qué diccionario usar con una expresión SQL (`dict_chooser`). Antes agrupaba por año (`year_1999`); ahora agrupa por fuente y año (`dof_1999`), así cuando llegue la constitución entrenará sus propios diccionarios en vez de "diluir" los del DOF. Cambiar la expresión es seguro: al descomprimir, cada renglón ya guarda el id del diccionario con que se comprimió.
- **Rutas con espacio de nombres.** La ingesta es idempotente por `documents.path` (si re corres, lo ya insertado se salta). Para que eso siga funcionando con varias fuentes, las rutas futuras se prefijan con la fuente (`constitucion/...`); el DOF conserva sus rutas históricas.

## Cambio de plan: vectores binarios en vez de TurboQuant

La PoC había cerrado con TurboQuant4 (4 bits por dimensión) como camino principal: calidad idéntica a fp32 después de la fusión híbrida. Pero al hacer cuentas para el corpus completo encontramos un problema de orden práctico: TurboQuant se aplica con `vector_quantize` de sqlite-vector, que **requiere los vectores fp32 ya guardados en disco**. Para 6.7 millones de chunks de 1,024 dimensiones son ~27 GiB — no caben en el disco de esta laptop.

La alternativa ya estaba validada como plan B: cuantización binaria por signo (cada dimensión se convierte en 1 bit: positivo o negativo). La diferencia de calidad medida es de ~1 punto de MRR en la fusión híbrida (0.649–0.650 contra 0.656), pero tiene dos ventajas decisivas:

1. **No pisa el disco en fp32.** El `sign()` se aplica en memoria dentro del pipeline de embeddings; lo único que se escribe es el blob de 128 bytes (1,024 bits). Cero vectores fp32 almacenados, cero paso de cuantización posterior.
2. **La búsqueda es lo más barato que existe.** Comparar dos vectores binarios es XOR + popcount (distancia de Hamming): hardware haciendo exactamente lo que mejor hace.

Antes de comprometer ~14 días de cómputo hicimos un piloto con 101,351 chunks reales:

| Verificación | Resultado | Extrapolado a 6.7M chunks |
|---|---:|---:|
| Base de vectores (sqlite-vec `bit[1024]`) | 151 B/vector | **0.94 GiB** |
| Escaneo Hamming (k=50) | 5.0 ms/consulta | ~0.33 s/consulta |
| Re-embedar un chunk y comparar bits | máx. 1 bit distinto de 1,024 | — |

El último renglón merece explicación: re-embedamos 64 chunks y comparamos bit a bit contra lo guardado. Máximo 1 bit de diferencia (el redondeo en el borde del signo cuando una dimensión cae casi en cero). Eso prueba que el camino completo — reconstruir texto desde la receta, prefijo `Document: `, servidor GGUF, empaquetado de bits — escribe exactamente lo que debe.

El pipeline además es reanudable desde el diseño, porque 14 días de cómputo continuo **van** a ser interrumpidos: los chunks se procesan en orden de `chunk_id`, cada lote es una transacción, y al reanudar se continúa después del `MAX(chunk_id)` existente. Una tabla `vector_meta` guarda modelo, prefijos y formato de empaquetado; si intentas reanudar con otra configuración, el proceso se niega en vez de mezclar embeddings incompatibles en silencio.

## Bug 1: el GROUP BY que se comió 35 GB de disco

La ingesta del corpus completo fue aburrida, que es lo mejor que se puede decir de una ingesta: 657,867 documentos en 428 segundos (~1,540 docs/s, igual que en la PoC). Lo interesante vino al comprimir.

El mantenimiento de sqlite-zstd (entrenar diccionarios y comprimir los renglones pendientes) falló dos veces con `SQLITE_FULL` ("database or disk is full"), aunque `df` mostraba decenas de GB libres. Vigilando el sistema de archivos mientras corría apareció el culpable: un archivo temporal `etilqs_*` creciendo a más de 24 GB.

¿De dónde salía? La consulta de mantenimiento que enumera el trabajo pendiente es, simplificada:

```sql
SELECT printf('%s_%d', source, year) AS grupo, count(*), sum(length(markdown))
FROM _documents_zstd WHERE _markdown_dict IS NULL
GROUP BY grupo;
```

Un `GROUP BY` sobre una expresión sin índice obliga a SQLite a ordenar las filas: materializa los registros en un **árbol B temporal en disco**. Con 10,000 documentos eso eran unos cientos de MB y nadie lo notó; con 31.5 GiB de texto sin comprimir, el temporal es del tamaño del corpus completo. El disco se llenó, SQLite reportó "full", y el mensaje de error no mencionaba temporales.

La solución tiene dos partes:

1. **Un índice de expresión** sobre la tabla interna que coincide exactamente con la expresión del `dict_chooser`: `CREATE INDEX ... ON _documents_zstd(_markdown_dict, printf('%s_%d', source, year))`. Con índice, el `GROUP BY` lee las filas ya ordenadas y el temporal desaparece — la misma consulta bajó de "llenar el disco en 3 minutos" a 66 segundos sin temporales.
2. **Entrenar los diccionarios nosotros**, con consultas indexadas por año (`WHERE year = 2011`), en vez de dejar que la extensión haga un escaneo completo por cada grupo. Esto además resolvió otro límite latente: el muestreo para entrenamiento guarda *todas* las filas de un grupo, y el grupo de 2011 (2.35 GiB) excede el máximo de 2 GB que acepta ZDICT. Nosotros controlamos el tamaño del *reservoir* (muestreo por reservorio: mantener N elementos elegidos uniformemente de un stream sin saber su tamaño total) y lo limitamos a 1.8 GiB.

Con eso, el mantenimiento completo tardó ~6 minutos y la base bajó de 32 GiB a **3.52 GiB** de manera incremental. La lección genérica: los planes de consulta que son inofensivos a escala de prueba (ordenamientos que derraman a disco, escaneos por grupo) son los primeros en romperse a escala real, y conviene mirar el `EXPLAIN QUERY PLAN` de cualquier consulta que toque toda la tabla — incluyendo las que escriben tus dependencias.

## Bug 2: el documento que se convertía en 21 GB de chunks

El chunking corrió a ~44 docs/s durante horas hasta que se detuvo en seco: 99% de CPU, cero progreso, en el documento 129,449 — una edición de 6.2 MiB de diciembre de 2004. Al muestrear la pila del proceso se veía una llamada al tokenizador tras otra: no era una llamada lenta, eran cientos de miles de llamadas rápidas (233,272 en 90 segundos, y contando).

El mecanismo, pieza por pieza:

1. El documento es una tabla ASCII de las antiguas (bordes `+---+`), y el chunker detecta las dos primeras líneas como "encabezado" de tabla para repetirlo en cada chunk.
2. Esas dos líneas miden 66 KB de guiones y signos de más: el encabezado solo ya supera el presupuesto de 800 tokens, dejando `max_row_tokens` **negativo**.
3. Con presupuesto negativo, cada renglón de datos "excede el límite", y la búsqueda binaria de `_force_split` converge a piezas de **un solo carácter**.
4. Cada pieza de un carácter se guarda como un chunk con el encabezado de 66 KB prependido.

Resultado: 519,113 chunks de un solo documento, **21 GB de texto de chunks a partir de 6.2 MB de entrada** — una amplificación de 3,200x. El bug siempre estuvo ahí; simplemente ningún documento de la muestra de 10k lo había disparado.

El arreglo es una guarda: si el "encabezado" consume todo el presupuesto de tokens, se trata como si no hubiera encabezado. El mismo documento ahora produce 195 chunks sanos en 4 segundos.

Aprovechamos para atacar el costo que lo hizo lento: el chunker contaba tokens llamando al tokenizador una vez por renglón/párrafo, con el overhead de Python por llamada. Pasamos los conteos a lotes (`encode_batch` del tokenizador Rust interno, con valores idénticos verificados), memoizamos los reconteos del overlap, y paralelizamos los force-splits de renglones (el núcleo Rust del tokenizador libera el GIL, así que los hilos escalan de verdad).

### La regla de oro: paridad exacta

Cualquier cambio al chunker cambia los chunks, y los embeddings y evaluaciones ya construidos dependen de ellos. Por eso la condición para aceptar estas optimizaciones fue **paridad bit a bit**: comparamos la salida vieja contra la nueva en los 499 documentos del set de evaluación más 300 aleatorios — 799/799 idénticos.

Lo interesante es lo que **no** pasó la prueba. Un primer intento "optimizaba" la búsqueda binaria de `_force_split` sembrando el rango con una estimación de caracteres por token. Falló en 7 de 799 documentos. La razón es sutil: el número de tokens de un prefijo no es monótono en la longitud del prefijo — un merge de BPE puede abarcar el punto de corte y *reducir* la cuenta al agregar un carácter. La búsqueda original (no monótona a prueba de todo) encuentra un corte; la sembrada encuentra otro, igual de válido pero distinto: chunk viejo de 2,792 caracteres, nuevo de 2,798, ambos exactamente 800 tokens. Revertimos la siembra y mantuvimos solo las optimizaciones que no tocan ninguna decisión.

## Estado actual

Las tres bases del sistema ya existen o están en marcha:

1. **Corpus**: `dof_corpus_l3.sqlite`, 3.52 GiB, todos los renglones comprimidos con su diccionario anual, verificado contra el árbol original.
2. **Chunks**: `dof_chunks.sqlite`, 6,730,304 chunks como recetas de spans (91 B/chunk promedio, 0.75% de respaldos literales), reconstrucción verificada en 500/500 muestras por el camino de consulta completo (p50: 1 ms por chunk).
3. **Vectores**: la corrida completa de embeddings está en progreso — 6.73 millones de chunks a ~5.7 chunks/s, unas 13.5 días de cómputo. Reanudable, como debe ser.

El número 6,730,304 cierra una incertidumbre de la arquitectura original: estimábamos ~5.1 millones de chunks; la medición real por documento (10.2 chunks/doc) lo confirma, y todas las proyecciones de disco ya usan la cifra medida.

Cuando termine la corrida de vectores vienen los dos pasos finales: el índice FTS5 para BM25 sobre el corpus completo (~2.8 GiB estimados) y la evaluación que importa — las 3,023 consultas del set de evaluación contra el corpus **completo**, no contra el subconjunto de 499 documentos. El MRR va a bajar respecto a las cifras de la PoC, y eso es señal, no regresión: encontrar un documento entre 657,867 es simplemente más difícil que encontrarlo entre 499.
