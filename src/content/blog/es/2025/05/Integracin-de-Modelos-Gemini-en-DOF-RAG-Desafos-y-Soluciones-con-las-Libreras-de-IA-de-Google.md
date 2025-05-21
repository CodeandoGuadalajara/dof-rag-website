---
title: >-
  Integración de Modelos Gemini en DOF RAG: Desafíos y Soluciones con las
  Librerías de IA de Google
date: 2025-05-16T06:00:00.000Z
author: Equipo DOF-RAG
description: >-
  Un análisis de los desafíos encontrados durante la integración de los modelos
  de IA de Google en el proyecto DOF RAG, el manejo de librerías en evolución y
  la resolución de problemas con las APIs.
image: '/images/posts/2025/05/ChatGPT Image 16 may 2025, 05_48_58 p.m..png'
tags:
  - Experiencia de Desarrollo
  - Dificultades
  - Google
  - Gemini
  - DOF-RAG
---

En el equipo del **Proyecto DOF-RAG**, nuestra misión fundamental es mejorar la accesibilidad y comprensión de la información contenida en el Diario Oficial de la Federación. Como parte de esta iniciativa tecnológica, tomamos la decisión de integrar los modelos de Inteligencia Artificial de Google. Esta elección se basó en la disponibilidad de una capa gratuita robusta, adecuada para nuestras pruebas iniciales con un LLM, y su utilidad para tareas críticas como la extracción de descripciones de imágenes —un componente esencial de nuestra arquitectura RAG— y la realización de consultas para validar la calidad de nuestros embeddings. El objetivo estratégico es la automatización de la ingesta y procesamiento de imágenes y, crucialmente, habilitar a nuestro sistema RAG para responder consultas basándose en el extenso corpus documental del DOF.

Sin embargo, el proceso de integración presentó un desvío significativo a través del ecosistema de librerías de IA de Google.

## Primeros Pasos: Navegando el Ecosistema de Librerías

Nuestra incursión inicial se realizó con la librería `generativeai`. Esta fue la implementación disponible en ese momento y cumplió con los requisitos básicos. No obstante, la rápida evolución del campo de la IA pronto nos dirigió hacia `genai`, una librería más reciente que prometía una integración mejorada y acceso a los modelos más avanzados de Google, como Gemini 2.0 y Gemma 3. La transición conceptual entre estas librerías fue relativamente directa; la implementación inicial parecía sencilla y el camino a seguir, claro.

## `genai`: Potencial y Desafíos de una Tecnología Emergente

La perspectiva de utilizar los modelos más recientes era atractiva. Sin embargo, trabajar con tecnología en etapas tempranas de desarrollo conlleva particularidades. Durante finales de abril y principios de mayo, nos enfrentamos a un escenario complejo y cambiante. Las políticas de uso parecían fluctuar, la propia implementación de la librería evolucionaba rápidamente y estos cambios ocurrían en un corto periodo.

La principal dificultad surgió con la gestión de las API keys. Disponíamos de una clave que había funcionado correctamente en pruebas previas. Sin embargo, el sistema comenzó a rechazarla inesperadamente. Este problema persistía incluso al utilizar los scripts de ejemplo proporcionados por Google en su documentación oficial. Se consideraron diversas causas, desde problemas de caché hasta interpretaciones incorrectas de variables de entorno por parte de la terminal. Se recurrió a medidas como reiniciar el entorno de desarrollo, aunque sin una expectativa clara de solución inmediata.

Los frecuentes cambios de versiones en las librerías (por ejemplo, la librería `google` pasó de la versión 0.3.0 a superar la 3.0 en pocas semanas, con `genai` siguiendo una pauta similar) presentaban desafíos adicionales. Aunque, en retrospectiva, los cambios más sustanciales se centraron en la incorporación de la configuración del "pensamiento" de los modelos, en su momento implicaron revisiones y adaptaciones en nuestro código. Por ejemplo, el método para enviar imágenes y obtener sus descripciones tuvo que ser modificado. No obstante, los errores persistentes y de difícil diagnóstico relacionados con la API key continuaron siendo el obstáculo más significativo, a pesar de seguir las implementaciones recomendadas por Google.

## Diagnóstico de los Problemas con la API Key

Los mensajes de error indicaban consistentemente una "API key inválida". Esto resultaba desconcertante, ya que la misma clave había sido utilizada con éxito en pruebas anteriores para la extracción de descripciones de imágenes con el modelo `gemini-2.0-flash` (seleccionado por su capa gratuita). Incluso el código oficial de Google, replicado exactamente en nuestro entorno local, producía el mismo error.

La consola de administración de Google Cloud no reportaba ninguna anomalía; la API key figuraba como activa y sin restricciones aparentes. Se realizó una revisión exhaustiva del entorno local: se crearon nuevas instancias de terminal, se intentó limpiar la caché y se reinició el editor de código en múltiples ocasiones. El problema, sin embargo, persistió durante varios días.

## La Resolución Inesperada del Problema

Finalmente, tras varios intentos y sin una modificación específica identificable que lo justificara, la integración comenzó a funcionar correctamente.

En un nuevo esfuerzo, se reimplementó el código proporcionado por Google AI Studio en un entorno completamente aislado. En esta ocasión, la ejecución fue exitosa. La causa exacta de la resolución no pudo ser determinada con precisión. El código era, en esencia, idéntico al utilizado previamente en el entorno de pruebas principal.

Inesperadamente, la API key fue aceptada, las llamadas a la API se completaron y los modelos respondieron según lo esperado. La resolución fue sorpresiva y no provino de una corrección directa y deliberada por nuestra parte. Se especula que la solución pudo deberse a actualizaciones no documentadas en la infraestructura de Google o a factores no identificados en el entorno local que se corrigieron fortuitamente. Este desenlace generó alivio, aunque también cierta perplejidad ante la naturaleza esquiva del problema y su eventual auto-resolución.

## Evaluación de los "Modelos Pensantes" para el DOF RAG

Las versiones más recientes de las librerías introdujeron la capacidad de configurar el "tiempo de pensamiento" de los modelos. Si bien es una característica interesante, para los objetivos actuales del proyecto DOF RAG, su utilidad es limitada.

En el contexto de la automatización de la extracción de descripciones de imágenes, añadir una latencia adicional por "pensamiento" para cada una de las miles de imágenes procesadas no resulta práctico. Para nuestro chatbot RAG, la agilidad en la respuesta es un factor crítico; los usuarios esperan respuestas rápidas a sus consultas.

No obstante, esta funcionalidad podría tener un beneficio potencial en la validación de la relevancia del contexto proporcionado al LLM. Por ejemplo, para verificar si un artículo del DOF ha sido derogado o reemplazado por uno más reciente, o si una ley citada mantiene su vigencia. Sin embargo, para el proceso de generación de respuesta directa del bot, se prioriza la eficiencia.

## Lecciones Aprendidas en la Integración de IA y Recomendaciones

Esta experiencia en la integración de las librerías de IA de Google nos proporcionó varias lecciones importantes:

1. **Precaución con la adopción temprana de tecnologías:** Las librerías en fases iniciales de desarrollo, aunque innovadoras, pueden presentar una mayor frecuencia de cambios, documentación incompleta y errores inesperados. La identificación de la causa raíz de los problemas puede requerir una inversión considerable de tiempo y esfuerzo.
2. **Considerar la estabilidad antes de actualizar:** A menos que una nueva versión ofrezca una funcionalidad crítica indispensable o solucione un problema bloqueante, puede ser prudente esperar a que las librerías alcancen un mayor grado de madurez antes de proceder con la actualización. De lo contrario, es probable que se requieran ciclos frecuentes de modificación del código.

## Conclusión y Próximos Pasos

A pesar de los obstáculos encontrados, hemos logrado superar estos desafíos técnicos. La implementación para el procesamiento de imágenes ha alcanzado un estado estable, y esperamos que mantenga su fiabilidad en el futuro. El proyecto DOF RAG continúa su desarrollo según lo planificado, y el equipo se muestra optimista respecto a los próximos avances.

Agradecemos su continuo interés en nuestro proyecto y los invitamos a seguir nuestro blog para mantenerse informados sobre los progresos, los desafíos técnicos y las experiencias del proceso de desarrollo.
