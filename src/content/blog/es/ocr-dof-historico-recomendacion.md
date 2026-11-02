---
title: 'Cómo elegimos un pipeline de OCR para el DOF histórico'
date: '2026-11-02'
author: 'Joaquín Bravo Contreras'
description: >-
  Comparamos modelos abiertos de OCR en 54 páginas del DOF, de 1920 a 1999.
  La mejor respuesta no fue un solo modelo: OvisOCR3 para el trabajo rápido,
  LightOnOCR-3-4B para las páginas difíciles y una regla para rechazar salidas
  repetitivas antes de que contaminen el corpus.
image: /images/posts/ocr-historico/1960-p02-expanded-prose.jpg
tags:
  - DOF-RAG
  - OCR
  - modelos
  - evaluacion
  - DGX-Spark
featured: true
---

## El problema: una página legible no siempre produce texto útil

Cuando abrimos una edición antigua del Diario Oficial de la Federación, vemos
texto. Una computadora, en cambio, puede estar viendo solamente una fotografía
de esa página. Para buscar un decreto, recuperar un artículo o alimentar un
sistema RAG necesitamos convertir esa imagen en caracteres: eso es **OCR**,
reconocimiento óptico de caracteres.

Los PDF que estudiamos presentan dos casos. Muchas ediciones anteriores a 1999
traen una capa de OCR oculta, pero es ruidosa; la edición de 1999 de nuestra
muestra directamente no tiene texto extraíble. Usar `pdftotext` y dar el
problema por resuelto sería como fotocopiar una mala traducción sin revisarla.

La pregunta práctica era esta: **¿qué pipeline conviene usar para digitalizar
el DOF histórico en nuestra DGX Spark, sin mandar los documentos a una API y
sin aceptar errores silenciosos?**

## La respuesta corta: dos modelos y un guardia de seguridad

Después de comparar 54 páginas, nuestra recomendación es:

1. **OvisOCR3 con vLLM para la primera pasada**, especialmente en prosa y
   páginas ordinarias. Es la opción rápida.
2. **LightOnOCR-3-4B con vLLM para tablas densas y como fallback**, la ruta de
   respaldo. Terminó las 54 páginas sin fallos por límite de salida.
3. **Una validación automática entre el modelo y el corpus.** Si Ovis llega al
   límite de tokens, produce una salida anormalmente larga o repite fragmentos,
   esa página se rechaza y se vuelve a procesar con LightOn.

La tercera pieza es tan importante como los modelos. Un OCR no debería poder
“ganar” escribiendo quince mil palabras inventadas.

## Cómo hicimos la comparación

Empezamos con 18 páginas: una de prosa jurídica y una difícil por cada una de
nueve ediciones entre 1920 y 1999. Una página difícil puede tener varias
columnas, tablas, cifras pequeñas, sellos o firmas. Después ampliamos a 54
páginas para los dos enfoques finalistas.

Congelamos los PDF, las imágenes renderizadas a **300 DPI**, los prompts, las
revisiones de los modelos y los parámetros de generación. También revisamos
visualmente las 54 transcripciones de referencia. El corpus Word/Markdown ya
existente no se usó como verdad de referencia: si la alineación no está
verificada, una referencia “plateada” puede enseñarnos el error con muy buena
tipografía.

Medimos varias cosas porque una sola cifra no cuenta toda la historia:

- **CER** (*Character Error Rate*): cuántos caracteres hay que insertar,
  borrar o sustituir para llegar a la referencia. Menos es mejor.
- **WER** (*Word Error Rate*): la misma idea, pero con palabras. Puede superar
  100% si el modelo inventa mucho texto.
- Identificadores exactos: fechas, artículos, cantidades y números de
  expediente.
- Celdas de tablas recuperadas literalmente.
- Orden de lectura, palabras omitidas y palabras inventadas.
- Tiempo por página y complejidad de operación.

Un ejemplo sencillo: si la página dice `ARTICULO 4o.` y la salida dice
`ARTICULO 70.`, casi todo se ve bien. Para una búsqueda jurídica, sin embargo,
el identificador quedó mal. Por eso no basta con medir “qué tan parecido se
ve” el texto.

## Los resultados

Estos fueron los resultados de la evaluación ampliada. Los tiempos son de
generación secuencial por página, sin incluir la carga inicial del modelo; no
son una promesa de concurrencia ni una estimación para todo el corpus.

| Sistema | CER | WER | Identificadores | Celdas | Mediana por página |
|---|---:|---:|---:|---:|---:|
| OCR oculto / `pdftotext` | 66.78% | 82.82% | 293/628 | 858/1,306 | No aplica |
| **LightOnOCR-3-4B, vLLM** | **11.05%** | **12.65%** | **616/628** | **1,254/1,306** | 77.82 s |
| OvisOCR3, vLLM | 30.35% | 87.23% | 542/628 | 1,185/1,306 | **14.50 s** |
| OvisOCR3, sólo sus 52 terminaciones normales | 6.29% | 10.60% | — | — | — |

La última fila explica la recomendación, pero **no sustituye** el resultado
completo. Ovis fue rápido y muy bueno en 52 páginas; en las otras dos entró en
un bucle de repetición. Esas salidas permanecen en la evaluación. Borrar los
fallos para proclamar un ganador sería esconder justo el comportamiento que
necesitamos controlar en producción.

En la ronda inicial también probamos PaddleOCR-VL-1.6 y LightOnOCR-3-0.8B.
Paddle tuvo la mediana más baja, 9.24 segundos, pero su CER fue 53.53% y falló
en dos tablas por límite de salida. El modelo LightOn de 0.8B tampoco justificó
el ahorro: 47.03% CER. LightOn 4B con Transformers obtuvo el mejor CER de esa
ronda, 15.59%, pero elegimos vLLM para ampliar por velocidad y operación.

## Ejemplo 1: cuando casi todo está bien, una fecha todavía puede salir mal

Esta página de 1960 contiene prosa jurídica a dos columnas.

![Página de prosa jurídica del DOF de 1960](/images/posts/ocr-historico/1960-p02-expanded-prose.jpg)

La referencia dice:

> El Censo Industrial y el Censo de Servicios […] se levantarán en **1961**,
> referidos a actividades del año de 1960.

LightOn recuperó ese fragmento correctamente. Ovis escribió **1931** en lugar
de 1961. El resto del párrafo se ve convincente, y precisamente por eso este
error importa: una revisión que sólo busque texto vacío no lo encontraría.

En la misma página, el OCR oculto produjo encabezados como
`Lunes 4 de enero r!e 1~60` y convirtió fragmentos de `ARTICULO 1o.` en texto
lleno de sustituciones. Sirve como señal auxiliar, pero no como transcripción
de referencia.

La lección para el pipeline es concreta: **hay que validar fechas, artículos y
números como campos críticos**, no esperar que una tasa global baja garantice
que cada dato jurídico sea correcto.

## Ejemplo 2: una tabla exige conservar valores y relaciones

Esta página de 1930 contiene tarifas con seis columnas numéricas.

![Tabla de tarifas del DOF de 1930](/images/posts/ocr-historico/1930-p04-expanded-difficult.jpg)

La primera fila de la referencia es:

| Concepto | Gobierno | Excedente | Tropical Radio | Excedente | Participación | Excedente |
|---|---:|---:|---:|---:|---:|---:|
| Mobile y Louisiana | 1.50 | 0.10 | 0.87 | 0.059 | 0.63 | 0.041 |

Ovis recuperó esa fila con Markdown. LightOn produjo HTML y también conservó
los valores. El formato de salida puede convertirse después; el trabajo crítico
es no cambiar `0.041` por `0.0410`, moverlo de columna o asociarlo con otra
ciudad.

Aquí también conviene una aclaración de maestro: nuestra métrica de celdas
comprueba coincidencias literales, pero **no demuestra por sí sola que toda la
estructura semántica de la tabla sea correcta**. Por eso guardamos la imagen,
la salida cruda y las evaluaciones por página, y mantenemos revisión visual
para tablas sensibles.

## Ejemplo 3: el fallo que no queremos indexar

En dos páginas de 1940, Ovis empezó razonablemente bien y terminó repitiendo
separadores durante miles de palabras. Cada una llegó aproximadamente a quince
mil palabras inventadas.

Este es el patrón que debe detener el guardia de seguridad:

```text
Balances y documentos similares, cuya inserción debe hacerse
conforme a la ley, por cada línea. . . . . . . . . . . . . . .
```

Una persona detecta el problema de inmediato. Un índice de búsqueda, si nadie
lo detiene, simplemente lo almacena. Por eso la regla no es “revisar Ovis
cuando tengamos tiempo”, sino **no aceptar esa salida en primer lugar**.

## El pipeline que recomendamos, paso a paso

### 1. Renderizar y congelar

Renderizamos cada página a **300 DPI**, guardamos la imagen y registramos los
hashes del PDF y del PNG. Así sabemos exactamente qué vio el modelo.

No recomendamos aplicar deskew, binarización o rotación a todo el corpus por
defecto. No medimos una ganancia que justifique esa transformación global.
Para una página concreta se puede evaluar un recorte o una rotación, pero eso
sería otro experimento. Tampoco probamos 400 DPI, así que no afirmamos que
“más resolución” necesariamente mejore el resultado.

### 2. Hacer la primera pasada con Ovis

Para prosa y páginas ordinarias, Ovis ofrece la mejor combinación de velocidad
y calidad que observamos. En las 54 solicitudes tardó 1,070 segundos en total;
LightOn tardó 4,747.6. Eso hace que Ovis sea útil para el volumen, siempre que
sus salidas pasen el filtro siguiente.

### 3. Rechazar antes de aceptar

Marcamos para reproceso cualquier salida con:

- terminación distinta de `stop`;
- límite de tokens alcanzado;
- texto vacío o anormalmente largo;
- repetición de n-gramas o separadores;
- estructura inesperada en una tabla o pérdida evidente de bloques.

No hace falta inventar un “score de confianza” para empezar. Estas reglas
simples habrían detectado los dos desastres de repetición del benchmark.

### 4. Reprocesar con LightOn 4B

Las páginas rechazadas, las tablas densas y los documentos con diseño complejo
van a LightOn. Si sólo quisiéramos operar un modelo, elegiríamos LightOn 4B:
es más lento, pero fue el finalista que completó las 54 páginas sin fallos por
límite de salida.

### 5. Conservar evidencia y revisar lo importante

Guardamos siempre la salida cruda antes de normalizar. Después revisamos por
muestreo y hacemos revisión obligatoria de identificadores, fechas, artículos,
totales y páginas que hayan pasado por fallback.

Lo que no hacemos es corregir silenciosamente el documento histórico. Si una
cifra o una grafía extraña está impresa, se conserva; la duda se anota, no se
“arregla” inventando una versión más moderna.

## ¿Por qué local y qué cuesta operarlo?

Los cuatro modelos prioritarios se ejecutaron localmente en la DGX Spark. No
hicimos llamadas a Kimi ni ChatGPT porque no había credenciales prácticas
configuradas; por tanto, tampoco hubo cargos de API.

“Local” no significa “sin costo”: hay GPU, tiempo de cómputo y mantenimiento.
Usamos vLLM 0.22.1, revisiones inmutables de modelos y un solo modelo grande
cargado a la vez. Esa disciplina operativa importa tanto como el CER cuando se
procesan miles de páginas: evita competir por memoria y permite repetir una
corrida exactamente.

## Qué sigue

La recomendación ya es accionable: **300 DPI, Ovis para velocidad, LightOn 4B
para dificultad y fallback, rechazo automático de salidas anómalas y revisión
de campos críticos**.

También tiene límites. Evaluamos 54 páginas de nueve ediciones, no todo el
corpus; no hicimos una prueba de concurrencia ni un barrido de DPI; y nuestras
métricas de tablas y orden no sustituyen la revisión visual. El siguiente paso
es aplicar el pipeline a una muestra más amplia, medir cuántas páginas caen en
cada ruta y revisar si esos umbrales mantienen el equilibrio entre velocidad y
calidad.

La lección principal se parece a la de nuestras evaluaciones anteriores: el
modelo importa, pero el sistema completo decide si el resultado es confiable.
Un OCR excelente sin validación puede llenar un índice de errores; un pipeline
modesto con evidencia, fallback y reglas de rechazo puede evitarlo.

---

El reporte técnico, los manifiestos, las transcripciones verificadas, las
salidas crudas y normalizadas y los resultados por página están en
`dof-rag/docs/ocr-benchmark-2026-11-02.md` y `dof-rag/var/ocr-benchmark/`.
