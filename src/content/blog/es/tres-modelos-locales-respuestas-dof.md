---
title: 'Tres modelos locales frente al DOF: terminar una respuesta no significa responder bien'
description: 'Probamos Qwopus, Qwen3.6 y Qwen3.8 con las mismas 42 preguntas del DOF. Qwen3.8 obtuvo más respuestas sustentadas en la revisión, pero también fue el más lento. Los errores muestran por qué una cita válida no basta y dónde conviene trabajar antes de abrir el piloto.'
date: '2026-09-07'
heroImage: ''
category: 'desarrollo'
tags: ['dof-rag', 'evaluacion', 'modelos-locales', 'evidencia', 'dgx-spark']
author: 'Joaquín Bravo Contreras'
---

## Después de recuperar documentos, hay que responder

El [último artículo de evaluación](/es/blog/2026/08/eval-hibrida-final-corpus-completo/) cerró con un cambio de frontera: ya habíamos medido la búsqueda híbrida contra el corpus completo, pero encontrar documentos y pasajes no nos decía todavía si el agente podía construir una respuesta correcta. Por otro lado, la [aplicación para evaluación humana](/es/blog/2026/08/evaluacion-humana-agente-dof-air/) nos daba un lugar donde hacer preguntas, observar las herramientas y guardar comentarios.

Entre ambas cosas faltaba una decisión práctica: **¿con qué modelo conviene atender un piloto pequeño sin consumir el presupuesto de las API que usamos para desarrollar?**

La pregunta nos llevó a probar tres configuraciones locales en una NVIDIA DGX Spark: Qwopus, Qwen3.6 y Qwen3.8. No buscamos al ganador general de los modelos abiertos, ni intentamos reproducir una tabla de velocidad de generación. Queríamos saber cuántas preguntas del DOF podían resolver con evidencia y cuánto tendría que esperar una persona por cada respuesta.

La primera tabla parecía sencilla. Después de revisar las respuestas, dejó de serlo:

| Configuración | Completó los controles automáticos | Respuestas sustentadas en la revisión* | Latencia media registrada |
|---|---:|---:|---:|
| Qwopus | 31/42 | 24/42 | 36.6 s |
| Qwen3.6 | 28/42 | 21/42 | **22.2 s** |
| Qwen3.8 | **37/42** | **29/42** | 62.3 s |

\* La revisión es provisional y asistida por IA, no un dictamen jurídico humano independiente. Los dos primeros modelos se revisaron contra las referencias y una selección de citas completas; para Qwen3.8 se inspeccionaron todos los pasajes citados. Más adelante explicamos qué cuenta como respuesta sustentada y por qué esta diferencia de revisión limita la comparación.

La lectura inicial es útil, pero acotada: **Qwen3.8 fue el candidato más prometedor en esta corrida, a cambio de una espera considerablemente mayor.** No cambiamos el modelo del piloto automáticamente. Qwopus siguió atendiendo el servicio al terminar las pruebas.

## Local no significa gratis

Mover la generación a la Spark responde primero a una restricción operativa. El entorno del piloto usa una configuración separada, sin las credenciales de los proveedores de desarrollo y sin un respaldo automático hacia una API de pago. Si el servidor local no está disponible, no queremos que una consulta pública se convierta silenciosamente en consumo de esos créditos.

Eso no vuelve gratuita la inferencia. Hay costo de equipo, electricidad, mantenimiento y capacidad ocupada. En este experimento no medimos energía ni amortización, así que no tenemos una cifra defendible de pesos por respuesta.

Además, la Spark es compartida. Probamos un servidor de generación a la vez, con una sola solicitud concurrente y una reserva de memoria conservadora. El acceso al piloto permaneció controlado: esta prueba no fue un lanzamiento público ni una medición con usuarios simultáneos.

La automatización preparaba los modelos, pausaba los servicios antes de la evaluación y restauraba Qwopus al terminar, también en caso de fallo. Guardamos resultados y procedencia para no depender de una terminal abierta ni perder las respuestas que después había que revisar.

## Qué comparamos realmente

Aunque para abreviar hablemos de tres modelos, comparamos **tres configuraciones completas de inferencia**:

| Nombre usado aquí | Modelo principal | Servidor y generación especulativa | Caché KV |
|---|---|---|---|
| Qwopus | `sojufx/Qwopus3.8-27B-Flash-NVFP4` | SGLang + DFlash2, K=16 | BF16 |
| Qwen3.6 | `unsloth/Qwen3.6-35B-A3B-NVFP4` | vLLM + DSpark, K=8 | FP8 |
| Qwen3.8 | `RadixArk/Qwen3.8-27B-NVFP4` | SGLang + DFlash2, K=16 | BF16 |

La tercera configuración sigue la [receta de Pangoleen para Qwen3.8-27B en DGX Spark](https://github.com/pangoleen/qwen3.8-27b-dgx-spark-dflash2). No es el mismo modelo principal que Qwopus, aunque ambos nombres incluyan «3.8» y usen DFlash2.

La generación especulativa utiliza un modelo auxiliar para proponer tokens que el modelo principal verifica. Puede acelerar la generación, pero no reemplaza la búsqueda, no decide qué fuente es correcta y no garantiza que la respuesta esté sustentada. Tampoco podemos atribuir todas las diferencias observadas a la capacidad del modelo principal: cambian el servidor, el auxiliar y la precisión de la caché.

Mantuvimos los siguientes presupuestos para las corridas completas:

- las mismas 42 preguntas de v4 y el mismo código del agente, comprobados mediante hashes;
- contexto de 32,768 tokens;
- hasta ocho turnos del modelo y ocho llamadas a herramientas;
- hasta 2,400 tokens de salida por turno;
- temperatura 1.0, `top_p=0.95` y `top_k=20`;
- modo de razonamiento explícito desactivado;
- recuperación híbrida disponible, con la estrategia concreta elegida por el agente.

Las [cinco herramientas de recuperación](/es/blog/2026/08/herramientas-recuperacion-agente-dof/) son las mismas: listar publicaciones, buscar documentos, buscar pasajes, consultar la estructura y leer chunks. Darles las mismas herramientas no significa que los modelos las usen igual. Precisamente queríamos medir esa diferencia.

Antes de estas corridas ajustamos la disciplina de evidencia del agente: mantener disponible la recuperación después de una lectura, distinguir una salida truncada de una respuesta final y hacer explícita la cobertura pendiente, entre otros cambios documentados en el [PR #86 de `dof-rag`](https://github.com/CodeandoGuadalajara/dof-rag/pull/86). **La tabla no es un experimento antes/después de ese PR**: las tres configuraciones se evaluaron con la misma versión posterior a esos cambios.

## Tres preguntas distintas detrás de una puntuación

El set v4 tiene seis preguntas en cada una de siete categorías: pasaje único, listas, transitorios, referencias cruzadas, varios documentos, monitoreo y premisas falsas. Es pequeño, pero obliga a hacer algo más que localizar una frase: comparar años, completar una enumeración, distinguir fechas o rechazar una suposición incorrecta.

Para interpretar sus resultados separamos tres niveles.

**1. ¿Terminó conforme al contrato?** El agente produjo una respuesta final que pasó los controles aplicables de formato, citas y cobertura. Eso es lo que cuenta la columna de completadas. Es una medida operativa necesaria: una respuesta que nunca llega no ayuda a quien preguntó.

**2. ¿Respondió correctamente lo solicitado?** Los valores, fechas y relaciones centrales coinciden con la evidencia. Una respuesta puede acertar aquí y estropearse después con una explicación adicional.

**3. ¿La respuesta entregada está suficientemente sustentada?** Revisamos también omisiones, contradicciones y afirmaciones que las citas no sostienen. No basta con que un ID exista o con que el agente haya leído ese pasaje.

En Qwen3.8, los tres niveles dieron números distintos:

| Lectura de la corrida | Resultado |
|---|---:|
| Pasó los controles automáticos | 37/42 |
| Núcleo de la respuesta correcto y sustentado | 34/42 |
| Respuesta sustentada sin problemas descalificadores en la revisión | 29/42 |

El desglose de la última revisión fue **29 sustentadas, ocho parciales o con problemas, una incorrecta en el dato solicitado y cuatro sin respuesta utilizable**. De las ocho problemáticas, cinco tenían correcto el núcleo, pero añadían detalles engañosos o dejaban afirmaciones sin una cita suficiente. Las otras tres tenían una parte central incompleta o contradictoria.

No penalizamos una errata o una diferencia de estilo como si fueran un error jurídico. Sí señalamos una fecha contradictoria, una ubicación confundida o una afirmación que no se puede comprobar en las citas. Tampoco certificamos la vigencia jurídica actual de una norma por haber verificado sus fechas históricas.

## Los errores que la tasa de finalización no ve

### Un tipo de cambio correcto para el día equivocado

La pregunta SP-002 pedía el tipo de cambio **obtenido por Banco de México el 9 de agosto de 2006**. Qwen3.8 contestó 10.9113 pesos por dólar y citó un pasaje real, leído por el agente.

El problema estaba dentro de esa misma fuente: el valor se había obtenido el **8 de agosto** y se publicó el **9**. Para la fecha solicitada correspondían **10.8386 pesos**, publicados el 10 de agosto.

No faltaba una cita. Faltaba distinguir la fecha del dato de la fecha de publicación.

Lo más interesante es que el mismo modelo resolvió correctamente MD-003, que pedía comparar ambos días: pasó de 10.9113 a 10.8386, una caída de 0.0727 pesos. En una pregunta encontró y explicó la distinción; en otra la perdió. Una sola corrida no permite convertir ese acierto en una capacidad estable.

### Acertar el valor y equivocarse al explicarlo

Qwen3.6 dio correctamente los valores solicitados de INPC y UMA en MO-001, pero describió el cambio de 0.28% del INPC como **interanual**. El pasaje decía que era la variación respecto de **noviembre de 2025**, es decir, mensual.

Qwen3.8 no cometió ese error en la misma pregunta. Sin embargo, añadió otros detalles innecesarios en respuestas distintas: interpretó `MAT` como «Materia Administrativa» o «Materia Legislativa», cuando el código identifica la edición **matutina** del DOF.

Esos errores no tienen la misma gravedad, pero comparten un patrón: la respuesta ya contenía lo necesario y perdió precisión al seguir explicando. Pedir concisión no es solamente ahorrar tokens; también reduce la cantidad de afirmaciones que debemos verificar.

### Una lista completa con una cita incompleta

En la pregunta sobre los siete objetos de la Ley General de Aguas, Qwopus enumeró los siete, pero citó un chunk que terminaba en la fracción V. Las fracciones VI y VII estaban en el siguiente pasaje.

El texto central era correcto, pero la cita no permitía comprobar toda la lista. Qwen3.8 leyó y citó ambos chunks en su respuesta.

También observamos el caso inverso: una cita distinta de la anotada como referencia podía ser válida. Una tabla del IMSS reproducía los tres valores de la UMA y los sustentaba explícitamente. Rechazarla sólo porque su ID no coincidía con el «oro» habría confundido coincidencia de identificadores con calidad de evidencia.

### Encontrar evidencia y no terminar de usarla

En MD-002, Qwen3.8 debía comparar la UMA de 2025 y 2026. Leyó el aviso de 2026 y encontró tarde la evidencia de 2025, pero no llegó a leerla y citarla antes de cerrar. La respuesta falló por cobertura documental.

En otra comparación, sobre los planes nacionales de desarrollo, insistió en buscar **Programa** Nacional de Desarrollo en lugar de **Plan**. Consumió turnos en publicaciones ajenas a los dos decretos de aprobación que necesitaba.

Aquí el diagnóstico no es «el modelo no conoce la respuesta». Son problemas del recorrido: cómo formula la búsqueda, cuánto presupuesto consume y si convierte un candidato encontrado en evidencia leída antes de finalizar.

### Corregir una premisa requiere decir que es falsa

La pregunta NE-004 suponía que la UMA de 2026 comenzó a aplicarse el 1 de enero. Qwen3.8 encontró la fecha correcta, **1 de febrero**, pero abrió su respuesta diciendo que la premisa no estaba documentada como falsa y la marcó como incierta.

Eso es contradictorio con la evidencia que acababa de presentar. La cautela es útil cuando falta información; no cuando impide expresar una corrección explícitamente sustentada.

## El tiempo que realmente espera una persona

No usamos tokens por segundo como métrica principal. Una consulta del agente incluye varios turnos, búsquedas, lectura de pasajes y posibles intentos de corregir una salida. Una buena velocidad de decodificación no garantiza una respuesta rápida de extremo a extremo.

| Configuración | Media | Mediana |
|---|---:|---:|
| Qwopus | 36.6 s | 34.1 s |
| Qwen3.6 | 22.2 s | 19.2 s |
| Qwen3.8 | 62.3 s | 48.8 s |

Incluimos las ejecuciones incompletas que tenían tiempo registrado, no solamente las exitosas. Qwopus tuvo una excepción del proveedor sin duración registrada: su media y mediana corresponden a **41 ejecuciones**, aunque el denominador de calidad sigue siendo 42. Las otras dos configuraciones tienen 42 tiempos.

Esa excepción también importa operativamente: se solicitaron 35,087 tokens frente a un contexto máximo de 32,768. No fue una respuesta semánticamente equivocada, pero para la persona el resultado fue el mismo: no recibió una respuesta útil.

Qwen3.8 tardó, en promedio, alrededor de 1.7 veces lo que Qwopus y 2.8 veces lo que Qwen3.6. Es una diferencia importante para un piloto con una sola ejecución concurrente: la espera de quien está en cola se suma a esos tiempos. Esta evaluación serial no mide capacidad bajo concurrencia ni tiempos de espera con varias personas.

## Hasta dónde llegan estas conclusiones

Hay varias razones para no presentar 29/42 como «la precisión de Qwen3.8» sin más contexto.

**Una corrida completa por configuración.** Usamos muestreo, no una ejecución determinista con resultados garantizados. Cada pregunta mueve la tasa aproximadamente 2.4 puntos porcentuales. La ventaja observada necesita repetirse.

**No es un examen desconocido para el sistema.** V4 ya orientó decisiones de recuperación y del agente. Sirve para regresiones y diagnóstico, pero una mejora aquí debe confirmarse con preguntas nuevas, como advertimos al preparar el piloto humano.

**La revisión no fue humana e independiente.** Un asistente de IA comparó respuestas, referencias y fuentes guardadas. Para Qwen3.8 leyó completos los 42 pasajes distintos citados e inspeccionó recorridos problemáticos. La revisión anterior de Qwopus y Qwen3.6 leyó las referencias y una selección de citas completas. No hicimos una nueva adjudicación ciega e idéntica de las tres corridas. Sus 24 y 21 son puntos de comparación provisionales; tampoco tenemos para ellas una puntuación separada de «núcleo correcto» comparable con el 34 de Qwen3.8.

**El corpus y el set necesitan mantenimiento.** El corpus creció respecto de la instantánea original de v4 y el validador conserva 15 fallos preexistentes relacionados con la instantánea y citas que no coinciden con los chunks. Hay además preguntas ambiguas: CR-003 dice «el decreto del Tren Maya» sin fecha ni identificador. Otro decreto puede contener el mismo procedimiento indemnizatorio. Ese desacuerdo con la referencia exige revisar la pregunta, no declarar automáticamente que la fuente alternativa es incorrecta.

**La comparación es de sistemas completos.** No aislamos el efecto de la cuantización, del servidor ni de la generación especulativa. Tampoco medimos un ahorro económico total ni comparamos estos resultados contra una API comercial bajo las mismas condiciones.

## Evidencia conservada y siguiente paso

Cada corrida conserva localmente las respuestas, las citas, las herramientas utilizadas, los motivos de finalización y su procedencia. Publicamos además un paquete de revisión en el [PR #86 de `dof-rag`](https://github.com/CodeandoGuadalajara/dof-rag/pull/86), con enlaces fijados al commit para que no cambien al actualizar la rama:

- [Reporte técnico y criterios de revisión](https://github.com/CodeandoGuadalajara/dof-rag/blob/bc63d324ac4ba48b5e58ef6a7e6e483161283ccf/docs/local-models-full-suite-results.md).
- [Resultados de las 126 ejecuciones y los 62 pasajes distintos citados](https://github.com/CodeandoGuadalajara/dof-rag/blob/bc63d324ac4ba48b5e58ef6a7e6e483161283ccf/eval/results/local-models-full-suite-2026-09-07.json).

El JSON incluye preguntas, respuestas de referencia, respuestas entregadas, citas, tiempos registrados, motivos de finalización, dictámenes y notas por caso. También conserva hashes del código, las preguntas y los resultados originales. El reporte contiene una comprobación ejecutable de los totales y las referencias a pasajes; esa comprobación valida el archivo, no decide si una afirmación es correcta.

No publicamos las trazas crudas completas, los lanzadores, las variables de entorno, las direcciones del servicio ni los mensajes crudos de error del proveedor. Es un paquete para auditar las respuestas y sus fuentes, no una imagen íntegra del entorno ni una garantía de reproducir exactamente una corrida estocástica.

La decisión inmediata no fue instalar un cuarto modelo. Fue mantener Qwopus en el piloto y concentrar el siguiente trabajo en tres fallas que aparecieron con distintos modelos:

1. **Fechas con función explícita:** distinguir publicación, obtención del dato y entrada en vigor.
2. **Cobertura antes de cerrar:** leer la evidencia pendiente y señalar con claridad qué parte no se pudo comprobar.
3. **Menos afirmaciones innecesarias:** no añadir explicaciones, ubicaciones o reglas que la respuesta no necesita y las citas no sostienen.

Después repetiremos los casos difíciles con Qwopus y Qwen3.8, seguidos de una confirmación sobre el set completo y preguntas nuevas. Si la ventaja de calidad persiste, quedará una decisión de producto: si vale la pena esperar cerca de un minuto por una mayor proporción de respuestas sustentadas.

La lección de estas pruebas es menos vistosa que una carrera de modelos, pero más útil para el proyecto: **una respuesta que termina, una respuesta que cita y una respuesta que está bien sustentada son tres logros distintos**. El piloto necesita los tres.
