---
title: 'Cómo elegimos a Qwen3.8 Flash Next para DOF-RAG (y qué todavía le falla)'
date: '2026-10-14'
author: 'Joaquín Bravo Contreras'
description: >-
  Evaluamos 33 configuraciones de modelos locales sobre 42 preguntas congeladas
  del DOF, revisadas respuesta por respuesta contra los pasajes que cada modelo
  leyó. Esto es lo que encontramos y por qué nos quedamos con Qwen3.8 Flash
  Next servido con TensorFold.
image: ''
category: 'desarrollo'
tags:
  - DOF-RAG
  - modelos
  - evaluacion
  - tensorfold
  - qwen
---

## El problema: responder sobre el DOF sin salir de nuestra máquina

DOF-RAG consulta el Diario Oficial de la Federación: decretos, resoluciones,
normas oficiales y acuerdos, casi siempre en español jurídico, casi siempre
con fechas y numerales que no perdonan una cifra movida. Cuando empezamos a
buscar modelo local, la tentación fue ir directo al leaderboard: descargar el
que estuviera más arriba y asumir que “más inteligente” significaba “mejor
para nosotros”.

La lección de estas semanas es que un leaderboard no responde la pregunta que
de verdad importa: ¿este modelo, con este servidor, en esta máquina, responde
bien **nuestras** preguntas dentro de **nuestros** límites de memoria y
latencia?

## Qué medimos (y qué no)

Construimos un conjunto congelado de 42 preguntas reales sobre el DOF: tipos
de cambio históricos de Banxico, salarios mínimos 2026, la Ley General de
Aguas, la NOM-035-STPS-2018, expropiaciones del Tren Maya, el Plan Nacional de
Desarrollo. Cada pregunta tiene respuesta de referencia y pasajes fuente
anotados.

Cada candidato corría el mismo protocolo: mismas preguntas, mismos límites
(2400 tokens de salida, ocho turnos, ocho llamadas a herramientas), mismos
parámetros de muestreo (temperatura 1, top-p 0.95, top-k 20, semilla 1234), y
un agente idéntico que busca, lee y cita pasajes reales de nuestra base.

Dos decisiones metodológicas marcaron todo lo demás:

1. **Contar respuestas correctas, no respuestas terminadas.** Un JSON válido
   con la fecha equivocada es una respuesta incorrecta con buena ortografía.
   Cada una de las 42 respuestas de cada brazo fue revisada a mano contra los
   pasajes que ese modelo efectivamente leyó. Si el modelo no leyó el pasaje
   donde está la respuesta, no se le prestó.

Hay un término que usaremos a lo largo del post: el **arnés** (del inglés
*harness*). Es todo lo que envuelve al modelo para que pueda trabajar: las
descripciones de las herramientas, la validación de argumentos, la gestión de
las premisas, la preservación de lo leído y la validación de la respuesta
final. El modelo genera texto; el arnés decide qué puede pedir, qué ve y
cuándo su respuesta se acepta.
2. **Un brazo por configuración completa.** Cuando cambiamos algo —un helper,
   un formato de finalización, un límite de razonamiento— corrimos las 42
   preguntas de nuevo. Nunca adjudicamos una mejora a un cambio sin una
   corrida completa posterior.

## Los resultados, ordenados

Treinta y tres brazos completos: 29 configuraciones Qwen (TensorFold, vLLM en
varias versiones, SGLang/Qwopus, llama.cpp/GSQ, myllmbox) más dos candidatos
que el equipo pidió explorar (MiniCPM-V4.7 y LFM2.5). Los números son
respuestas **sustentadas por los pasajes leídos**, de un total de 42:

| # | Configuración | Correctas | Completadas | Latencia media |
|---:|---|---:|---:|---:|
| 1 | Stock Qwen3.8 (27B NVFP4) + DFlash2, corregido | 38 | 40 | 63.5 s |
| 2 | Stock Qwen3.8 corregido, repetición | 37 | 38 | 54.1 s |
| 3 | GSQ (llama.cpp) corregido | 36 | 39 | 76.0 s |
| 4 | Myllmbox corregido | 35 | 40 | 145.3 s |
| 5 | Qwopus (SGLang) base | 33 | 36 | 41.8 s |
| 6 | TensorFold BF16, corregido (2 repeticiones) | 33 | 39 | 33.4–34.2 s |
| 7 | **TensorFold FP8, corregido (2 repeticiones)** | **31** | **37** | **31.6 s** |
| 8 | Qwen3.6 vLLM0.28 “producción 262K” | 30 | 36 | 20.4 s |
| 9 | MiniCPM-V4.7 (muestreo pareado) | 26 | 32 | 24.5 s |
| 10 | LFM2.5, brazo ajustado | 22 | 33 | 41.8 s |
| 11 | LFM2.5, base | 14 | 19 | 62.8 s |

Una aclaración importante sobre velocidad: la latencia de la tabla es tiempo
por pregunta completa (búsquedas, lectura de pasajes, generación). La
velocidad de decodificación pura de TensorFold ronda los 90–102 tokens por
segundo en prompts cortos, muy por encima de lo que un humano lee. Lo que se
siente lento en una sesión de chat no es el modelo pensando: es el recorrido
completo de herramientas alrededor.

## Por qué ganó Qwen3.8 Flash Next

Si sólo importara la columna de correctas, ganaría el stock Qwen3.8 de 27B con
38. Lo descartamos como default por una razón simple: sus 63 segundos por
pregunta son el doble que TensorFold, y su stack de serving (vLLM afinado con
draft model) consumía más memoria con menos asientos. En un producto
interactivo, una respuesta correcta a los dos minutos compite con una
razonable a los treinta segundos.

Qwen3.8 Flash Next es un modelo de ~125B parámetros totales con activación de
~5B por token (arquitectura A5B, cuantización AutoRound INT4). Servido con
TensorFold 1.0 en nuestra DGX Spark nos dio una combinación que nadie más
igualó:

| Criterio | TensorFold FP8 | Stock 27B | GSQ |
|---|---|---|---|
| Correctas (corregido) | 31 | 38 | 36 |
| Latencia media | 31.6 s | 63.5 s | 76.0 s |
| Contexto por asiento | 262,144 tokens | 32,768 | 262,144 |
| Asientos concurrentes | 4 | 1 | 1 |
| Visión (imágenes del DOF) | Sí | Sí | No |
| Memoria mínima libre en perfil | ~52 GiB | ~52 GiB | ~93 GiB |

El contexto largo no es adorno: las preguntas de cronología (una declaratoria
de utilidad pública, dos publicaciones y un decreto) requieren leer documentos
de 20 mil tokens o más. Con 32K de contexto, ese tipo de pregunta se vuelve
imposible por diseño.

También pesó la operación: durante más de treinta lanzamientos secuenciales,
cada interrupción —fallida o no— restauró automáticamente el servicio
anterior, sano y sin calentamiento, antes de reactivar los pilotos. Un modelo
que puedes probar sin miedo a dejar el sistema caído vale más que uno que
debes tratar con guantes.

## Qué le falla: ejemplos reales

Ser honestos sobre las fallas fue lo que hizo útil a la evaluación. Estas son
respuestas reales del brazo corregido de TensorFold, con nuestro veredicto de
revisión:

**Un desfase de un día en el tipo de cambio (MD-003).** La pregunta pide la
variación entre el tipo de cambio obtenido el 8 y el 9 de agosto de 2006. El
modelo respondió con los valores del 7 y el 8, reportando un incremento de
+0.0275 cuando la serie correcta (10.9113 → 10.8386) es una **disminución** de
0.0727. Falló la aritmética de fechas, no la lectura: tenía los documentos
correctos a la vista y eligió los días equivocados.

**Una fecha de caducidad inventada (TE-002).** Preguntado por la vigencia de
la UMA de 2026, acertó el valor, la publicación del 9 de enero y el inicio de
vigencia el 1 de febrero… y agregó sin sustento una “caducidad el 31 de
enero de 2027”. Ningún pasaje leído menciona esa fecha. Es el patrón más
peligroso que observamos: respuestas correctas coronadas con un detalle
fabricado.

**Un dato omitido en una lista (MO-001).** Ante “¿qué valores de INPC y UMA
publicó el INEGI el 9 de enero de 2026?”, dio el INPC mensual completo y los
tres valores de UMA, pero omitió el INPC quincenal que sí estaba en el pasaje
que había leído. En una lista, un elemento menos es una lista incorrecta.

**Abstenciones correctas pero costosas (SP-002, TE-004, LI-001).** En tres
preguntas el modelo declaró, con honestidad, “no puedo verificarlo con lo que
leí” y cerró sin respuesta. Preferimos eso a una invención, pero revela que
su estrategia de búsqueda a veces se agota un documento antes de encontrar la
evidencia: la resolución de CONASAMI estaba en el índice, y no la leyó.

| Falla | Tipo | Frecuencia observada |
|---|---|---|
| Fecha desplazada (día anterior/posterior) | Aritmética temporal | 2 casos |
| Detalle inventado tras respuesta correcta | Alucinación de precisión | 1 caso |
| Lista incompleta | Cobertura parcial | 2 casos |
| Abstención por evidencia no leída | Estrategia de búsqueda | 3 casos |
| Rechazo estricto del esquema JSON | Serialización | 4 casos |

## La palanca no es el modelo: es el arnés

Aquí está la parte que más nos sorprendió. El mismo TensorFold, sin tocar el
modelo ni el servidor, cambió sus resultados así:

| Brazo | Correctas | Latencia |
|---|---:|---:|
| Base (agente original) | 22 | 31.3 s |
| + corrección de premisas en helpers | 31 | 31.6 s |
| + compactación read-only en la finalización | 29 | **28.9 s** |

Nueve respuestas correctas de diferencia vinieron de cambios en el arnés:
cómo se formulan las premisas, cómo se preserva el historial de lecturas al
compactar, cómo se valida el JSON final. El modelo ya sabía; el arnés no lo
dejaba demostrarlo.

Un contraste útil: Qwen3.6 no mostró ese mismo potencial. Con el agente
original ya alcanzaba 28 correctas, y los mismos helpers que le dieron nueve a
TensorFold apenas lo movieron (25 con los helpers iniciales, 29 tras un
segundo ajuste). La razón es diagnóstica: las fallas de TensorFold eran
del arnés (serialización y finalización), mientras que las de Qwen3.6 son de
capacidad y ejecución — un caso emblemático fue una pregunta cuyo contexto
rebasó su techo de 32,768 tokens y el servidor respondió con un error HTTP
400. Estirar su ventana a 64K preservó el resultado pero no lo mejoró. En
otras palabras: a TensorFold lo limitaba el envoltorio, a Qwen3.6 lo limita
el modelo, y el envoltorio es mucho más barato de cambiar. Por eso el
siguiente frente de trabajo no es cambiar de modelo, sino seguir mejorando el
arnés —y repetir el brazo completo después de cada cambio, porque la
variación entre repeticiones existe y hay que medirla, no asumirla.

De los dos candidatos añadidos, MiniCPM-V4.7 quedó en 26 correctas (rápido, con
visión y mucha memoria libre, pero por debajo en exactitud); LFM2.5, aunque un
control conjunto (límite de razonamiento + JSON forzado) lo llevó de 14 a 22,
sigue siendo el menor de los evaluados, es de sólo texto y su licencia lo
restringe a organizaciones con ingresos anuales bajos 10 millones de dólares.

## Qué sigue

Qwen 4 aparecerá tarde o temprano, y con él habrá que repetir todo. Por eso
dejamos el protocolo congelado, la tabla completa de 33 brazos y el índice
machine-readable en el repositorio (`docs/all-qwen-model-selection-results.md`),
junto con la guía para evaluar cualquier candidato nuevo contra los mismos 42
casos.

Las conclusiones tienen límites y conviene declararlos: comparamos sistemas
completos, no modelos aislados; las mejoras por tweak están confundidas con la
variación natural entre corridas salvo que se repitan; y ningún brazo prueba
capacidad de cuatro ventanas completas de 262K tokens en simultáneo — probamos
un asiento a la vez.

Mientras tanto, el DOF sigue publicándose todos los días, y nuestro agente
tiene ahora un modelo con el que contesta en treinta segundos, cita lo que
leyó, y —cuando no sabe— lo dice.
