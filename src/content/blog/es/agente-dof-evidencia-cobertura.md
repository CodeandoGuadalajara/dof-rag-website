---
title: 'Un agente que sabe cuándo le falta evidencia: primeras corridas sobre el DOF'
description: 'Cómo construimos un bucle acotado de herramientas, convertimos las partes de una pregunta en requisitos verificables y evaluamos sus respuestas sobre el DOF.'
date: '2026-08-16'
heroImage: ''
category: 'desarrollo'
tags:
  ['dof-rag', 'rag-agentico', 'herramientas', 'evaluacion', 'evidencia', 'kimi']
author: 'Joaquín Bravo Contreras'
---

## De herramientas aisladas a un recorrido completo

En el [artículo anterior](/es/blog/2026/08/herramientas-recuperacion-agente-dof/) separamos la búsqueda de publicaciones de la recuperación de pasajes. El resultado fueron cinco herramientas deterministas: listar publicaciones, buscar documentos, buscar evidencia, navegar el índice de un documento y leer chunks.

El siguiente paso fue permitir que un modelo decidiera cómo combinarlas. No queríamos que el modelo buscara sin límites ni que una respuesta fluida ocultara una recuperación incompleta. Construimos un orquestador pequeño: en cada turno el modelo solicita una herramienta con argumentos estructurados o entrega la respuesta final.

```text
pregunta
   ↓
modelo ── solicita herramienta ──→ validador ──→ DOF-RAG/SQLite
   ↑                                      │
   └──────── resultado + call_id ─────────┘
   │
   └── respuesta JSON → validación de citas y cobertura
```

El recorrido tiene estados: descubrir documentos, descubrir evidencia, leer chunks y responder. El modelo sólo ve las operaciones válidas para el estado actual. Hay un máximo de ocho llamadas a herramientas y, según la versión evaluada, entre seis y ocho turnos. Si no reúne la evidencia necesaria dentro de esos límites, la ejecución termina como incompleta.

Los límites no sólo controlan costo. También vuelven comparables las corridas: una configuración que necesita ocho búsquedas para una pregunta no se comporta igual que otra que la resuelve con tres.

## Argumentos estrictos y errores visibles

Cada herramienta se describe con un esquema JSON estricto. Por ejemplo, `read_chunks` acepta entre uno y ocho IDs, permite como máximo un vecino a cada lado y rechaza propiedades adicionales:

```json
{
  "name": "read_chunks",
  "strict": true,
  "parameters": {
    "type": "object",
    "properties": {
      "chunk_ids": {
        "type": "array",
        "items": { "type": "integer" },
        "minItems": 1,
        "maxItems": 8
      },
      "neighbor_window": {
        "type": "integer",
        "minimum": 0,
        "maximum": 1
      }
    },
    "required": ["chunk_ids", "neighbor_window"],
    "additionalProperties": false
  }
}
```

El servidor vuelve a validar los argumentos antes de consultar las bases. Una fecha posterior al corte, un documento que el agente nunca descubrió o un chunk que no apareció en una búsqueda previa producen un error estructurado. El modelo puede corregir la llamada en el siguiente turno, pero no ampliar silenciosamente el alcance de la consulta.

Cada traza conserva el turno, la herramienta, los argumentos, el resultado, el tiempo y el `call_id` que enlaza la solicitud con la respuesta. También registra tokens, latencia, versiones de índices, motivo de terminación y citas rechazadas.

## Primera muestra: cerrar no significa contestar bien

La primera muestra usó Kimi K2.7 Code, BM25 y siete preguntas: una por cada categoría de v4. Las siete ejecuciones terminaron con un objeto JSON válido, pero la revisión manual contó sólo dos respuestas correctas, dos parciales y tres no resueltas.

Ese contraste fue más útil que el 7/7 de cierres. Mostró que validar la forma de una respuesta no garantiza que el agente haya reunido todas sus partes.

| Falla observada                                       | Cambio realizado                              | Qué queríamos conseguir                             |
| ----------------------------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| Elegía otra publicación del mismo día                 | Mostrar título e institución                  | Reconocer la fuente, no una coincidencia incidental |
| Confundía normas que compartían número                | Priorizar identificadores completos y títulos | Recuperar la norma emisora                          |
| Leía sólo un año de una comparación                   | Registrar requisitos de cobertura             | Impedir el cierre hasta leer ambos documentos       |
| Cerraba con JSON válido pero sin evidencia suficiente | Exigir lectura y citas válidas                | Marcar la ejecución como incompleta                 |

Los cambios no aparecieron de una sola vez. Cada uno respondió a una trayectoria que podíamos inspeccionar.

## Reconocer la publicación correcta

Una pregunta de monitoreo pedía lo publicado por el INEGI el 9 de enero de 2026. La fecha reducía el universo, pero todavía dejaba varias publicaciones. Una de ellas mencionaba la UMA dentro de una sanción y podía superar al documento correcto por coincidencia lexical.

`list_publications` devolvía originalmente fecha, sección, ruta e ID. Añadimos título e institución extraídos del encabezado para que el agente pudiera ver la diferencia:

```text
652586  INSTITUTO NACIONAL DE ESTADISTICA Y GEOGRAFIA
        ÍNDICE nacional de precios al consumidor

652600  Secretaría de Seguridad y Protección Ciudadana
        PUBLICACIÓN DE SANCIÓN
```

También incorporamos expansiones deterministas para `INEGI`, `INPC` y `UMA`. No son sinónimos generados durante la corrida: la misma consulta siempre produce los mismos términos.

Otro grupo de preguntas confundía normas con números parecidos. `NOM-035` no identifica por sí sola una norma: existe en distintos sectores. Cuando la consulta incluye `NOM-035-STPS-2018`, el buscador comprueba si el identificador completo aparece en el título y da prioridad a la fuente emisora sobre acuerdos o convocatorias que sólo la citan. El resultado expone ese aumento de puntaje por separado.

## Cubrir la pregunta antes de cerrar

Encontrar dos documentos tampoco garantiza que el agente lea los dos. En una comparación de salarios de 2025 y 2026, ambos documentos aparecieron entre los candidatos, pero la primera corrida leyó únicamente el pasaje de 2025 y respondió con la mitad de la información.

El estado de la ejecución conserva ahora requisitos verificables:

```json
{
  "coverage": {
    "2025": true,
    "2026": false
  }
}
```

Mientras quede un requisito falso, las herramientas de búsqueda y lectura siguen disponibles y el orquestador rechaza el cierre. El mismo mecanismo sirve para una referencia que parte de un transitorio y lleva al numeral 5.2: leer el transitorio cubre el primer salto, pero no la obligación contenida en 5.2.

Las listas se descomponen de forma parecida. Si una pregunta pide obligaciones para centros con hasta 15 trabajadores, entre 16 y 50 y con más de 50, el runner registra tres requisitos. Un solo pasaje no cuenta como lista completa sólo porque contiene uno de los rangos.

Estas reglas no constituyen una descomposición general del lenguaje jurídico. Reconocen patrones explícitos observados en v4: años comparados, rangos, numerales, periodos del PND, identificadores normativos y algunas acciones jurídicas. Su ventaja es que se pueden probar; su límite es que todavía no cubren todas las formas de formular una subpregunta.

## Citar algo leído y corregir una premisa

El esquema final exige al menos una cita, pero esa condición tiene que comprobarse dos veces. Una lista como `[999]` satisface el tipo JSON aunque el agente nunca haya leído ese chunk. Después de eliminar IDs no autorizados debe quedar al menos una cita válida; de lo contrario, el cierre se rechaza.

Las premisas falsas necesitan una restricción adicional. “No encontré el artículo 99” no demuestra que el artículo no exista. Para marcar una premisa como falsa, el agente debe citar evidencia, cubrir las anclas de la pregunta y formular una corrección afirmativa. Si sólo puede informar una búsqueda fallida, debe responder que la situación no está clara.

El código verifica procedencia, cobertura y forma de la corrección. No decide mediante una expresión regular si la interpretación jurídica es verdadera. Esa relación entre afirmación y pasaje sigue requiriendo revisión humana.

## Qué cambió en las corridas

La progresión se entiende mejor si se separa cierre formal de corrección sustantiva:

| Corrida                              | Alcance                        | Cierres válidos | Revisión manual                                       |
| ------------------------------------ | ------------------------------ | --------------: | ----------------------------------------------------- |
| Primer bucle                         | 7 preguntas, una por categoría |             7/7 | 2 correctas, 2 parciales, 3 no resueltas              |
| Después de identidad y cobertura     | Las mismas 7 preguntas         |             7/7 | 6 correctas, 1 parcial                                |
| Corrida completa desde `ba4e954`     | 42 preguntas                   |           41/42 | 35 correctas, 3 parciales, 4 incorrectas o pendientes |
| Contratos sobre los casos pendientes | 7 fallas seleccionadas         |             5/7 | 4 correctas, 1 incorrecta, 2 no resueltas             |

La última fila no debe compararse como si fuera una muestra aleatoria: contiene precisamente siete fallas de la corrida anterior. Que sólo cinco hayan cerrado indica que los contratos dejaron de aceptar algunas respuestas parciales, no que el sistema completo cayera de 41/42 a 5/7.

Dos casos ilustran la diferencia. [MD-002](/es/evals/v4/#md-002) preguntaba cómo cambiaron los valores diario, mensual y anual de la UMA entre 2025 y 2026. El agente leyó y citó la publicación de cada año antes de comparar los tres valores.

[MD-004](/es/evals/v4/#md-004) pedía reconstruir otra clase de respuesta: la secuencia desde las dos publicaciones de una declaratoria de utilidad pública hasta el decreto de expropiación de 14 inmuebles para el Tren Maya, incluidos los plazos para presentar pruebas y controvertir la indemnización. La tarea requería evidencia de tres publicaciones. El agente no reunió la secuencia completa dentro del presupuesto y terminó como cobertura incompleta. No contestó la pregunta, pero describió correctamente la limitación de esa ejecución.

Las métricas automáticas también necesitan contexto. La precisión y el recall de citas se calculan sólo sobre ejecuciones con cierre válido; la tasa de cierres se reporta por separado. Además, v4 puede penalizar un chunk alternativo que contenga la misma evidencia pero no esté anotado en el conjunto de referencia. Una cita coincidente ayuda a verificar procedencia, pero no sustituye la lectura de la respuesta.

## V4 se convirtió en conjunto de desarrollo

Hay una limitación metodológica mayor. Las fallas de v4 sirvieron para diseñar varias reglas: abreviaturas institucionales, identificadores normativos, periodos, listas y requisitos multidocumento. Sus 42 preguntas se convirtieron de hecho en nuestro conjunto de desarrollo.

Los resultados muestran que las correcciones resolvieron casos observados, que el agente puede reunir evidencia mediante varias rutas y que el runner bloquea más cierres incompletos. No demuestran todavía que las reglas se generalicen a preguntas nuevas.

V4 seguirá siendo útil como prueba de regresión. El siguiente resultado que puede medir generalización necesita un conjunto nuevo y bloqueado: debemos escribir y anotar sus preguntas antes de ejecutar el sistema, congelar el código y evitar añadir reglas después de ver las respuestas.

Después podremos comparar BM25 con búsqueda híbrida cuando el índice vectorial tenga cobertura exacta y reportable. La comparación deberá mantener constantes las preguntas, los límites, el modelo y los contratos. También necesitamos representar mejor las subpreguntas multidocumento y registrar evidencia alternativa en el conjunto de evaluación.

El avance de este hito no es una cifra final de calidad. Es que ahora podemos distinguir una respuesta completa de un JSON válido, rastrear de dónde salió cada cita y declarar qué parte de una pregunta todavía no tiene evidencia.
