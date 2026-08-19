---
title: 'De la evaluación automática a una prueba humana del agente del DOF'
description: 'Cómo construimos una aplicación local para probar el agente con preguntas reales, transmitir su proceso verificable y guardar respuestas y feedback sin depender del índice vectorial.'
date: '2026-08-18'
heroImage: ''
category: 'desarrollo'
tags: ['dof-rag', 'evaluacion-humana', 'air', 'sse', 'sqlite', 'trazabilidad']
author: 'Joaquín Bravo Contreras'
---

## El siguiente conjunto de preguntas no estaba en un archivo

Las evaluaciones automáticas nos permitieron medir recuperación, citas y
cobertura sobre preguntas conocidas. También nos ayudaron a corregir fallas
concretas del agente. Pero tenían una limitación inevitable: después de varias
iteraciones, esas preguntas ya habían influido en el diseño del sistema.

El siguiente paso no era añadir más reglas a v4, sino observar qué sucede cuando
una persona formula una pregunta nueva. Para hacerlo necesitábamos algo más que
un script de evaluación: una interfaz donde alguien pudiera preguntar, esperar
una ejecución que puede tardar decenas de segundos, revisar las fuentes y
explicar por qué una respuesta le resultó útil o insuficiente.

El [PR #68 de `dof-rag`](https://github.com/CodeandoGuadalajara/dof-rag/pull/68)
construye ese primer sitio de prueba. Es una aplicación pequeña, ejecutada desde
la misma MacBook que contiene el corpus, con acceso controlado mediante
Tailscale. No pretende ser todavía un servicio público, pero sí explorar cómo
abrir el proyecto fuera de las evaluaciones y demostraciones preparadas. Su
función es convertir el uso humano del agente en observaciones que podamos
revisar y reproducir.

Este trabajo continúa el [bucle acotado de herramientas](../agente-dof-evidencia-cobertura/),
pero cambia la pregunta de ingeniería. Antes queríamos saber si el agente podía
cerrar correctamente 42 casos anotados. Ahora necesitamos saber qué vio una
persona, qué hizo el agente durante la espera y qué información debemos guardar
para entender su evaluación días después.

## Un primer público en PyCon Latam

Esta semana llevamos el proyecto a
[PyCon Latam 2026](https://pylatam.org/), la conferencia de Python que se celebra
del 20 al 23 de agosto en Costa Rica. Además de presentar el trabajo de
procesamiento, recuperación y evaluación del DOF, esperamos mostrar esta
interfaz a un grupo reducido de asistentes.

La prueba tiene un propósito distinto al de una demostración con preguntas
preparadas. Queremos observar qué pregunta alguien que no ha participado en el
desarrollo, si entiende la fecha de corte y el número de documentos requeridos,
cuánta espera considera razonable y qué necesita ver para confiar —o dejar de
confiar— en una respuesta.

La conferencia ofrece un entorno útil para esta primera exposición: un público
técnico puede reconocer las limitaciones de un servicio ejecutado desde una
laptop y, al mismo tiempo, formular preguntas que no pertenecen a v4. El acceso
seguirá siendo por invitación y con límites estrictos. No es un lanzamiento
abierto, sino una forma controlada de aprender qué tendría que cambiar para que
el proyecto pudiera ofrecerse después por otras vías.

## Una aplicación junto al agente, no dentro del blog

La primera posibilidad era añadir la interfaz al sitio Astro de este blog. Eso
habría unido dos componentes con ciclos de vida distintos: el blog es estático y
se publica en GitHub Pages; el agente necesita Python, bases SQLite locales,
claves de proveedores y un proceso que permanece activo.

La aplicación terminó dentro de `dof-rag`, junto al código que ejecuta el agente:

```text
navegador
    │ HTML, formularios y Server-Sent Events
    ▼
aplicación Air
    ├── sesión, CSRF y límites de uso
    ├── cola local + un worker
    └── SQLite de evaluación
             │
             ▼
      AgentRunner + DofToolbox
             │
             ├── corpus y chunks en modo de solo lectura
             └── proveedor del modelo
```

Elegimos [Air](https://airwebframework.org/) porque permite definir rutas, HTML
y el ciclo ASGI con poco código. La interfaz inicial podía cambiar varias veces
en una tarde sin introducir un frontend separado. La lógica importante no
depende del framework: contratos, persistencia, cola y adaptación del agente
viven en módulos distintos. Si la capa web cambia, el registro de ejecuciones no
tiene que cambiar con ella.

El repositorio usa Python 3.12, por lo que fijamos Air 0.35.0. Las versiones
posteriores requieren Python 3.13. Es una decisión pragmática para el piloto, no
una elección permanente de plataforma.

La arquitectura de un solo origen también simplifica seguridad. Las claves de
Kimi u OpenAI permanecen en variables del proceso; el navegador nunca recibe
credenciales ni rutas a las bases. La aplicación no habilita CORS y el cliente
no puede enviar consultas SQL ni argumentos arbitrarios para las herramientas.

## Crear una ejecución y consultar su estado

Una respuesta del agente puede tardar 30, 40 o más segundos. Mantener una única
petición HTTP abierta durante todo ese tiempo hace difícil distinguir entre una
ejecución lenta, una conexión perdida y un servidor detenido.

El formulario crea en cambio una ejecución y recibe inmediatamente un
identificador. El estado sigue una máquina pequeña:

```text
queued ──→ started ──→ succeeded
                    └─→ failed
```

El navegador consulta después la página de esa ejecución. Un hilo worker toma
los trabajos de una cola acotada y llama al agente fuera de la petición que los
creó. Si el teléfono cambia de red o se cierra la pestaña, el trabajo continúa.

El contrato público acepta sólo cuatro campos:

```text
question           texto de 3 a 2000 caracteres
as_of              fecha de corte opcional
required_hops      entre 1 y 5 documentos necesarios
client_request_id  identificador para reintentos seguros
```

`client_request_id` resuelve un problema común en formularios: un doble toque o
un reenvío después de perder conexión no debe cobrar y ejecutar dos veces la
misma pregunta. La combinación de evaluador e identificador es única. Si se
repite con la misma entrada, se devuelve la ejecución existente; si se intenta
reutilizar para otra pregunta, el servidor rechaza el conflicto.

El MVP permite una ejecución activa por evaluador, una cola global de veinte y
un solo worker. Estos números protegen una laptop y hacen explícito el alcance:
la admisión es segura dentro de un proceso, no entre varias réplicas del
servidor.

## Qué significa transmitir el trabajo del agente

La primera versión sólo mostraba que la ejecución estaba en progreso. La
siguiente transmitía eventos técnicos, pero el resultado era una lista de JSON
difícil de interpretar. El dato útil para una persona no es que terminó la
llamada número cuatro, sino qué intentaba comprobar y qué encontró.

Construimos entonces un registro público de decisiones observables. Sus eventos
incluyen:

- el objetivo general de la investigación;
- el inicio de un turno del modelo;
- la herramienta elegida y sus argumentos validados;
- por qué esa operación es necesaria dentro del flujo;
- documentos candidatos y pasajes devueltos;
- solicitudes de corregir una respuesta incompleta;
- el resultado de verificar citas y cobertura.

Por ejemplo, antes de `read_chunks` la interfaz puede mostrar:

```text
Leyendo los chunks 6632609 para comprobar la evidencia.
Sólo los chunks leídos pueden convertirse en evidencia y citas de la respuesta.
```

Al terminar, el ID funciona como un enlace compacto. Al expandirlo aparecen el
documento, la ruta de encabezados y un extracto acotado. Así se puede seguir el
recorrido sin cubrir la pantalla con bloques completos del DOF.

Este registro no es la cadena de pensamiento privada del modelo. No guardamos
ni mostramos tokens internos, borradores de respuesta o razonamientos ocultos.
Además de no ser una interfaz estable entre proveedores, esos tokens pueden
contener hipótesis descartadas y texto no verificado. Para evaluar el sistema
nos sirven señales más concretas: qué operación pidió, con qué alcance, qué
documentos recibió, qué texto leyó y qué reglas pasaron o fallaron.

La distinción mejora la utilidad de la traza. “El modelo pensó que éste parecía
el decreto correcto” es difícil de comprobar. `search_documents` devolvió el
documento `651143` y después `read_chunks` leyó el pasaje `6632609` son hechos
que podemos reproducir.

## SSE para seguir una ejecución sin atarla a la conexión

Los eventos se transmiten con Server-Sent Events (SSE), un protocolo sencillo
sobre HTTP para enviar una secuencia del servidor al navegador:

```text
id: 7
event: progress
data: {"sequence":7,"event_type":"tool_completed",...}
```

Cada evento tiene un número creciente por ejecución. Si se pierde la conexión,
el navegador vuelve a enviar el último ID recibido y el servidor reproduce sólo
los eventos posteriores. Cuando llega el evento terminal, la página solicita el
fragmento con la respuesta completa. Un polling convencional queda como
respaldo para navegadores sin SSE.

El stream tampoco es la fuente de verdad. Cada paso se guarda primero en
SQLite; SSE sólo transporta lo ya persistido. Una recarga reconstruye el mismo
“Proceso de investigación”, y ese bloque permanece disponible —cerrado y
expandible— después de aparecer la respuesta final. En una ejecución fallida se
abre por defecto para facilitar el diagnóstico.

La implementación consulta SQLite cada 500 milisegundos por cliente conectado.
Es suficiente para unas cuantas personas en un piloto. No sería una buena
arquitectura para cientos de streams simultáneos; ese escenario requeriría
notificaciones desde el worker, intervalos mayores o un broker compartido.

## Buscar un chunk no equivale a leerlo

La interfaz hizo visible una distinción que ya existía en el contrato del
agente. `search_evidence` devuelve pasajes candidatos, mientras que
`read_chunks` entrega el texto que puede sostener una cita. También
`get_document_outline` devuelve una propiedad llamada `chunks`, pero allí cada
entrada sólo describe la estructura del documento: posición, encabezado y
tamaño.

En la primera prueba real, el adaptador público trató cualquier propiedad
`chunks` como evidencia leída. Al procesar un outline buscó texto y un
`document_id` que esa estructura no debía incluir. La ejecución falló antes de
mostrar la respuesta.

La corrección no consistió en rellenar campos inexistentes. El adaptador ahora
clasifica el resultado según la herramienta que lo produjo:

```python
chunks = data.get("chunks", []) if name == "read_chunks" else []
```

Sólo `read_chunks` puede producir pasajes expandibles y citables. El outline
continúa sirviendo para navegar, pero no se presenta como algo que el agente ya
leyó. Una prueba de regresión ejecuta ambas herramientas y comprueba esa
diferencia.

Es un detalle pequeño con una consecuencia general: no basta con que dos objetos
tengan la misma clave para que representen el mismo concepto. La procedencia de
un dato forma parte de su tipo.

## Guardar preguntas, respuestas y feedback

Decidimos guardar las preguntas. Sin ellas, una valoración como “falta
evidencia” no permite reconstruir qué se pidió, cuál era la fecha de corte ni
cuántos documentos esperaba la persona. También guardamos la respuesta exacta,
las citas, los documentos, los pasajes, la cobertura y el proceso público.

La base de evaluación está separada del corpus y de los índices. Su esquema se
organiza en cuatro tablas principales:

| Tabla          | Contenido                                                |
| -------------- | -------------------------------------------------------- |
| `runs`         | pregunta, corte, hops, evaluador seudónimo y procedencia |
| `run_events`   | transiciones `queued`, `started`, `succeeded` o `failed` |
| `run_progress` | pasos públicos ordenados y reconectables                 |
| `feedback`     | valoración, tipos de problema y comentario opcional      |

Las transiciones y el feedback son append-only en lo posible. No se reescribe
una ejecución exitosa para convertirla en fallida, ni una segunda valoración
borra la primera. SQLite usa WAL y una conexión nueva por operación para que el
hilo HTTP y el worker no compartan accidentalmente una conexión.

El feedback ofrece tres valoraciones —útil, parcialmente útil y no útil— y un
vocabulario de problemas: respuesta incorrecta, evidencia faltante, mala cita,
cobertura incompleta, error de fecha de corte, dificultad de lectura u otro.
También admite un comentario breve.

Nada de esto modifica automáticamente v4. Una pregunta humana interesante puede
convertirse después en candidata para v5, pero necesita revisión, respuesta de
referencia y evidencia anotada antes de entrar a un conjunto de evaluación. El
feedback sirve para descubrir casos, no para crear verdad de referencia por
votación.

## Reproducibilidad más allá del texto de la respuesta

Dos ejecuciones con la misma pregunta pueden cambiar porque cambió el código, el
modelo o el índice. Por eso cada fila de `runs` captura antes de encolar el
trabajo:

- revisión de Git y presencia de cambios locales;
- versión del corpus y del chunker;
- disponibilidad y huella del índice vectorial;
- proveedor, modelo y esfuerzo de razonamiento;
- límites de turnos y herramientas;
- modo de recuperación.

La procedencia distingue además `vector_available` de `vector_used`. Durante
este piloto el archivo vectorial puede existir y seguir incompleto, pero el
ejecutor usa recuperación lexical. Registrar sólo “hay un índice” atribuiría a
los vectores una respuesta en la que nunca participaron.

Esta separación nos permite probar la interfaz sin esperar a que termine la
indexación. Más adelante podremos comparar recuperación lexical e híbrida sin
cambiar la forma de almacenar una ejecución.

La misma revisión de reproducibilidad alcanzó los archivos del repositorio.
`scripts/eval_v4_full.py` y el reporte canónico de recuperación son código y
documentación metodológica, por lo que quedaron versionados. Los JSON de
corridas, caches, bases, logs y listas de fallos siguen siendo artefactos
generados: se conservan localmente, pero no se mezclan con el código del
experimento. Distinguir entre receta, reporte y resultado es necesario para
repetir una evaluación sin borrar la evidencia de corridas anteriores.

## El cierre del proceso también forma parte del contrato

Una revisión del PR encontró un caso operativo menos visible. `close()` enviaba
un centinela a la cola con una escritura bloqueante. Si la cola estaba llena y
el worker esperaba una respuesta del proveedor, apagar el servidor podía quedar
bloqueado. Además, después del timeout el hilo podía recibir la respuesta y
guardar un éxito aunque el servicio ya se considerara cerrado.

El cierre ahora realiza cuatro acciones:

1. deja de admitir trabajos nuevos;
2. marca un evento de cierre compartido con el worker;
3. intenta insertar el centinela sin bloquear;
4. descarta y registra a nivel de depuración cualquier progreso tardío.

Un bloqueo coordina la transición de cierre con las escrituras. Si el proveedor
continúa después del timeout, no puede añadir un estado terminal tardío. Al
arrancar una nueva instancia, una ejecución que había comenzado se marca como
interrumpida y las que seguían en cola se recuperan.

La prueba correspondiente ocupa más código que la corrección: bloquea un
ejecutor, llena la cola, mide que `close()` regrese rápido, libera la respuesta
tardía y arranca un servicio nuevo sobre la misma base. Ese recorrido verifica
el comportamiento que importa, no sólo que un método pueda llamarse.

## Un piloto deliberadamente pequeño

La aplicación usa invitaciones individuales, sesiones firmadas, CSRF, cookies
`HttpOnly`, aislamiento entre evaluadores, límites de cuerpo y encabezados de
seguridad. Las bases del corpus se abren en modo `query_only`. El access log de
Uvicorn está desactivado para no incorporar direcciones IP al conjunto de
evaluación; cualquier proxy deberá adoptar o declarar su propia política.

Quedan límites conocidos. La cola y el rate limit viven en memoria. Air se fijó
a una versión anterior por Python 3.12. La política CSP permite temporalmente
scripts y estilos inline. La laptop todavía necesita un supervisor y un túnel
HTTPS estable antes de invitar a un grupo mayor. El polling de SSE y el worker
único sólo tienen sentido a esta escala.

El resultado de la sesión no es un frontend terminado. Es un circuito mínimo
para hacer una pregunta nueva, observar operaciones verificables, revisar las
fuentes, guardar la respuesta y asociarle feedback estructurado. Con ese
circuito podemos presentar una primera interfaz en PyCon Latam y empezar a
encontrar fallas que v4 ya no estaba en condiciones de revelar, sin confundir
una prueba con público reducido con un servicio listo para producción.
