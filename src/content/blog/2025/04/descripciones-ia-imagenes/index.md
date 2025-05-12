---
title: >-
  Cuando los modelos de IA describen imágenes: lo brillante, lo absurdo y lo
  cómico
date: 2025-04-29T00:00:00.000Z
author: Equipo DOF-RAG
description: >-
  Un análisis comparativo de diferentes modelos de IA en la tarea de describir
  imágenes para el proyecto DOF-RAG.
image: /images/posts/chatgpt-image-25-mar-2025-09_27_39-p.m..png
tags:
  - DOF-RAG
  - IA
  - descripción-imágenes
  - Gemini
  - Ollama
featured: true
---

\\

# El desafío de la información invisible en documentos oficiales

El Diario Oficial de la Federación (DOF) publica miles de documentos cada año que contienen información crítica para ciudadanos, empresas y entidades gubernamentales. Un desafío particular que hemos identificado es la gran cantidad de información valiosa contenida exclusivamente en imágenes: tablas de datos, gráficas estadísticas, infografías explicativas, diagramas técnicos y mapas. Esta información visual permanece "invisible" para los sistemas tradicionales de búsqueda y recuperación de información.

Cuando construimos sistemas de Recuperación Aumentada por Generación (RAG) como DOF-RAG, nos enfrentamos a un problema fundamental: **si la información importante está contenida en imágenes, pero nuestro sistema solo puede procesar texto, ¿cómo podemos hacer que esa información sea accesible?**

## ¿Por qué necesitamos descripciones textuales de imágenes?

El archivo histórico digital del DOF contiene más de 25,000 imágenes acumuladas a lo largo de aproximadamente 20 años. Estas imágenes no son simples elementos decorativos, sino que frecuentemente contienen información gubernamental crucial que debe ser accesible tanto para humanos como para sistemas automáticos.

Existen varias aproximaciones para abordar este problema:

1. **Extracción automática de descripciones (nuestro enfoque)**: Utilizar modelos de IA multimodales para generar descripciones textuales detalladas del contenido de cada imagen, que luego se indexan junto con el texto del documento.
2. **Sistemas de embedding de imágenes**: Alternativas como [CLIP de Jina AI](https://huggingface.co/jinaai/jina-clip-v1) o [Nomic Embed Vision](https://huggingface.co/nomic-ai/nomic-embed-vision-v1.5) que generan representaciones vectoriales de las imágenes, permitiendo búsquedas semánticas directamente sobre el contenido visual sin necesidad de descripciones textuales intermedias.
3. **OCR especializado**: Para imágenes que contienen principalmente texto (como tablas o infografías textuales), se podrían aplicar técnicas avanzadas de reconocimiento óptico de caracteres.

Para nuestro proyecto, hemos optado por el primer enfoque: la extracción automática de descripciones textuales. Esta aproximación nos permite:

* Integrar fácilmente la información visual en nuestros índices de texto existentes
* Mantener un flujo de procesamiento coherente para todo tipo de contenido
* Aprovechar las capacidades de comprensión multimodal de los modelos de IA más recientes

En nuestro proyecto de extracción automática de descripciones de imágenes, hemos puesto a prueba varios modelos de IA para evaluar su capacidad de generar descripciones precisas y útiles. Los resultados han sido fascinantes, desde descripciones increíblemente detalladas hasta interpretaciones que nos han hecho cuestionar si la IA y nosotros estábamos mirando la misma imagen.

## El caso de la imagen misteriosa

Mientras probábamos cómo los modelos de IA describen imágenes, analizamos varias fotos de un archivo del DOF. Para este ejemplo usaremos una sola imagen (la que llamamos "\_page\_337\_Figure\_4.jpeg"). Los resultados fueron curiosos: cada modelo dio descripciones muy diferentes de la misma imagen. Esto nos hizo preguntarnos si estos sistemas son realmente confiables cuando se usan en situaciones reales.

La imagen en cuestión es la siguiente:

![Programa Precios de Garantía a Productos Alimentarios Básicos - SEGALMEX](/images/posts/2025/04/_page_337_Figure_4.jpeg)

Como se puede apreciar, se trata de una infografía sobre un programa de precios de garantía para productos alimentarios básicos (maíz y frijol) del gobierno mexicano, a través de SEGALMEX. Sin embargo, las interpretaciones que recibimos de los diferentes modelos fueron interesantemente diversas.

A continuación presentamos los resultados obtenidos con distintos modelos, analizando tanto la precisión semántica como los tiempos de procesamiento:

> **Nota sobre las métricas:** Para cada modelo presentamos dos valores clave:
> **Tiempo (segundos)**: Cuánto tardó el modelo en generar la descripción.
> **Tokens**: Unidades básicas de texto generado (palabras o partes de palabras). A mayor número, más detallada suele ser la respuesta.

### Ollama con gemma3:4b - El modelo compasivo pero lento

**Pregunta:** ¿Qué se observa en esta imagen?

**Descripción:**

> La imagen muestra una fotografía de un joven, presumiblemente un niño, sentado en una silla de ruedas. El niño tiene una expresión seria y se le ve concentrado. La foto parece ser de un contexto educativo o informativo, posiblemente relacionada con la sensibilización sobre la discapacidad o la movilidad infantil. No se identifica un lugar o región específica, pero la composición sugiere un mensaje de apoyo, comprensión y, posiblemente, de promoción de la inclusión.**MÉTRICAS:**
> Tiempo: 129.4466s | Tokens: 110

La descripción generada por gemma3:4b presenta una narrativa coherente y contextualmente plausible sobre inclusión y discapacidad. Sin embargo, tras contrastar con la imagen original, constatamos que **la imagen no contiene ningún niño en silla de ruedas**. Este fenómeno, conocido en el campo como "alucinación", resulta particularmente preocupante cuando se invierte más de dos minutos en generar información completamente ficticia.

### Mismo modelo, segunda oportunidad

En un segundo intento con el mismo modelo (gemma3:4b), obtuvimos:

**Descripción:**

> La imagen muestra un diagrama de flujo que representa el proceso de desarrollo de un software. Se distingue un ciclo de vida que incluye fases como la planificación, el análisis, el diseño, la implementación, las pruebas y el mantenimiento. El diagrama destaca la iteración continua y la importancia de la retroalimentación en cada etapa del desarrollo.**MÉTRICAS:**
> Tiempo: 121.9237s | Tokens: 137

Resulta notable observar cómo, ante la misma imagen, el modelo pasa de describir "un niño en silla de ruedas" a "un diagrama de flujo de desarrollo de software". Esta inconsistencia fundamental entre ejecuciones secuenciales del mismo modelo con parámetros idénticos sugiere una inestabilidad significativa en el proceso de interpretación visual, además de mantener tiempos de procesamiento superiores a los dos minutos.

### Gemini - Veloz y preciso

El modelo Gemini ofreció una descripción sustancialmente diferente:

**Descripción:**

> El documento es un "PROGRAMA PRECIOS DE GARANTÍA A PRODUCTOS ALIMENTARIOS BÁSICOS: MAÍZ Y FRIJOL". Aparece el logotipo de SEGALMEX con el eslogan "SEGURIDAD ALIMENTARIA MEXICANA". El documento está organizado en ocho secciones numeradas que explican que el programa busca incentivar el ingreso de pequeños y medianos productores agropecuarios y está dirigido a productores de maíz y frijol que cumplan con criterios de elegibilidad.**MÉTRICAS:**
> Tiempo: 3.8s | Tokens: 187

Tras verificación con la imagen original, confirmamos que la descripción de Gemini corresponde con alta precisión al contenido real de la imagen: un documento informativo sobre un programa gubernamental de apoyo agrícola. Además de su precisión semántica, destaca el tiempo de procesamiento excepcionalmente bajo (menos de 4 segundos) y la generación de un mayor número de tokens que las alternativas locales.

En pruebas adicionales con otras imágenes, Gemini mantuvo consistentemente este nivel de rendimiento, combinando descripciones detalladas y precisas con tiempos de respuesta notablemente eficientes. Durante el tiempo que los modelos locales requerían para describir una sola imagen (aproximadamente 2 minutos), Gemini podía procesar eficazmente unas 30 imágenes.

Sin embargo, es importante señalar que el uso de Gemini está sujeto a las limitaciones de su API, que actualmente permite solo 15 peticiones por minuto. Esta restricción nos obligó a implementar un sistema de procesamiento por lotes con períodos de enfriamiento entre ellos. A pesar de esta limitación, la velocidad y precisión de Gemini siguen siendo muy superiores a las alternativas locales, lo que lo convierte en la opción preferente para entornos productivos donde la calidad descriptiva es prioritaria.

## Cuando los modelos responden a la pregunta... con otra pregunta

Algunos modelos de Ollama decidieron que era más interesante darnos instrucciones sobre cómo deberíamos responder, en lugar de describir la imagen:

**Respuesta:**

> Resume su contenido porque tiene una respuesta más completa. Describe el tipo de imagen y su propósito probable, pero no te extiendas en detalles visuales menores, pero asegúrate de IDENTIFICAR todos los elementos importantes.**MÉTRICAS:**
> Tiempo: 87.6s | Tokens: 43

Es como si el modelo dijera: "¿Describir la imagen? No, gracias. Prefiero decirte cómo deberías hacerlo tú." ¡La audacia! Y para colmo, tardó casi 1.5 minutos en darnos estas instrucciones que nadie pidió.

## La barrera del idioma: Moondream solo habla inglés (y lentamente)

Otro desafío que enfrentamos fue con los modelos Moondream, que solo generan descripciones en inglés. Tuvimos que realizar un postprocesamiento para traducir sus respuestas al español. Un ejemplo de sus descripciones originales:

> The image presents a vibrant infographic that is a riot of colors and shapes. At the heart of the infographic, a person is depicted in a dynamic pose, suggesting movement or action. The person's head is tilted to one side, adding a dynamic element to the otherwise static structure.**MÉTRICAS:**
> Tiempo: 145.7s | Tokens: 63

Que traducido vendría a ser: "La imagen presenta una vibrante infografía que es un estallido de colores y formas. En el corazón de la infografía, se representa a una persona en una pose dinámica, sugiriendo movimiento o acción. La cabeza de la persona está inclinada hacia un lado, añadiendo un elemento dinámico a la estructura estática."

¿Estallido de colores? ¿Persona en pose dinámica? ¿Estamos seguros de que este modelo no estaba describiendo un anuncio de Pepsi de los años 90? Y para empeorar las cosas, tardó casi 2.5 minutos en generar esta fantasía colorida.

## Comparativa de rendimiento: David vs. Goliat

Al comparar los modelos locales (Ollama) con los servicios en la nube (Gemini), la diferencia es abrumadora:

| Modelo             | Tiempo promedio  | Tokens generados | Precisión estimada | Limitaciones                                                           |
| ------------------ | ---------------- | ---------------- | ------------------ | ---------------------------------------------------------------------- |
| Gemini             | 3-5 segundos     | 150-200          | 85-95%             | • 15 peticiones/minuto<br>• 1500 peticiones/día<br>• Requiere internet |
| Ollama (gemma3:4b) | 120-130 segundos | 100-140          | 20-30%             | • Sin límites de API<br>• Rendimiento limitado por hardware local      |
| Moondream          | 140-150 segundos | 60-80            | 15-25%             | • Sin límites de API<br>• Solo genera en inglés                        |

Estas métricas evidencian no solo la superioridad en velocidad de los modelos en la nube (30-40 veces más rápidos), sino también en la calidad y precisión de las descripciones generadas. Los modelos locales, aunque valientes en su intento, parecen estar jugando en una liga completamente diferente.

A pesar de la limitación de 15 peticiones por minuto que impone la API de Gemini, su rendimiento sigue siendo muy superior. En una hora de procesamiento con períodos de enfriamiento incluidos, Gemini puede procesar aproximadamente 750-800 imágenes con descripciones precisas, mientras que un modelo local solo llegaría a procesar unas 25-30 imágenes en el mismo período, con resultados significativamente menos fiables.

Sin embargo, el límite diario de 1500 peticiones de Gemini representa un obstáculo significativo para proyectos de gran escala. En nuestras pruebas con documentos del DOF de los últimos tres años, identificamos más de 4,000 imágenes que requerirían procesamiento. Considerando que el DOF lleva aproximadamente 20 años publicándose en formato digital, estimamos que el volumen total podría superar las 25,000-30,000 imágenes, lo que haría inviable utilizar exclusivamente la versión gratuita de Gemini para un proyecto completo.

La siguiente tabla ilustra el tiempo estimado que tomaría procesar diferentes volúmenes de imágenes con cada modelo:

| Volumen de imágenes | Gemini       | Ollama (gemma3:4b) | Híbrido    |
| ------------------- | ------------ | ------------------ | ---------- |
| 1,000 imágenes      | \~1.5 días\* | \~36 horas         | \~20 horas |
| 5,000 imágenes      | \~3.5 días\* | \~7.5 días         | \~4 días   |
| 30,000 imágenes     | \~20 días\*  | \~45 días          | \~30 días  |

\*Limitado por la cuota diaria de 1500 peticiones

Esta realidad nos lleva a considerar enfoques híbridos que combinen la precisión de modelos en la nube para documentos críticos, con el procesamiento masivo de modelos locales para el resto del contenido.

## Aspectos técnicos: Cómo funciona el sistema de descripción de imágenes

Para entender mejor los resultados que hemos presentado, es importante conocer la arquitectura del sistema que utilizamos para probar los diferentes modelos de IA. Este análisis nos permite comprender no solo los resultados, sino también el funcionamiento interno de la solución.

### Arquitectura general del sistema

Nuestro sistema sigue un patrón de diseño orientado a interfaces que permite intercambiar diferentes proveedores de IA sin modificar el código principal. Esta arquitectura flexible nos ha permitido comparar varios modelos bajo las mismas condiciones de prueba.

#### Componentes principales:

1. **Interfaz abstracta de cliente (`AbstractAIClient`)**:
   * Define los métodos estándar que todos los proveedores de IA deben implementar
   * Asegura la consistencia en la forma de procesar imágenes y generar descripciones
   * Proporciona métodos para configurar parámetros como temperatura, tokens máximos, etc.
2. **Implementaciones concretas**:
   * **`GeminiClient`**: Cliente para Google Gemini, optimizado para extracción de texto visible y documentos oficiales
   * **`OllamaClient`**: Permite usar modelos locales como gemma3:4b, eliminando la dependencia de APIs externas
   * **`OpenAIClient`**: Aunque implementamos la conexión con modelos GPT-4o para análisis de imágenes, es importante destacar que no utilizamos esta implementación en nuestras pruebas finales debido a limitaciones presupuestarias. El costo por petición de la API de OpenAI resultaba prohibitivo para un proyecto de esta escala, especialmente considerando el alto volumen de imágenes que necesitábamos procesar. Nos enfocamos en alternativas gratuitas o de menor costo que pudieran escalarse a nuestras necesidades.
3. **Utilitarios de procesamiento**:
   * Sistema de manejo de archivos para procesamiento por lotes
   * Mecanismo de checkpoint para reanudar procesamiento interrumpido
   * Registro detallado de métricas para analizar rendimiento

### Análisis de rendimiento técnico

Al examinar el código y las métricas de tiempo de ejecución, encontramos explicaciones técnicas para las diferencias de rendimiento:

1. **Modelos locales vs. en nube**:

```python
# Ejemplo de configuración de cliente Ollama (local)
client = OllamaClient(
    model="gemma3:4b",          # Modelo local
    max_tokens=512,             # Tokens máximos de salida
    temperature=0.5,            # Control de creatividad
    num_ctx=8192                # Tamaño de contexto
)
```

Los modelos locales como gemma3:4b procesan todo en el hardware local, lo que explica los tiempos de procesamiento de 120-130 segundos por imagen, mientras que los modelos en la nube utilizan infraestructura especializada de alto rendimiento.

1. **Bloqueo de recursos**:

```python
api_lock = threading.Lock()

# Dentro del método process_image
with api_lock:
    # Llamada a la API
```

Esta sincronización es necesaria para los clientes de API en la nube, pero no para los modelos locales, lo que puede afectar el rendimiento en procesamiento por lotes.

1. **Configuración de parámetros**:

| Parámetro   | Efecto en la generación                                           |
| ----------- | ----------------------------------------------------------------- |
| Temperature | Valores más bajos (0.2-0.4) producen respuestas más deterministas |
| Max tokens  | Limita la longitud máxima de la respuesta                         |
| Top\_p      | Controla la diversidad mediante muestreo de núcleo                |
| Top\_k      | Restringe el vocabulario a las k palabras más probables           |

Durante nuestras pruebas, mantuvimos estos parámetros constantes para garantizar una comparación justa entre modelos.

### Cómo procesamos las imágenes

El procesamiento de imágenes sigue este flujo:

1. **Preparación de la imagen**: Conversión a formato bytes compatible con cada API
2. **Generación del prompt**: Utilizamos un prompt estandarizado en español para todos los modelos
3. **Llamada al modelo**: Envío de la imagen y el prompt al modelo correspondiente
4. **Procesamiento de respuesta**: Validación y formateo de la descripción generada
5. **Almacenamiento**: Guardado de la descripción en archivo .txt junto a la imagen original

Para el modelo Gemini, que demostró ser el más eficiente, el código real que usamos es el siguiente:

```python
# Proceso de generación con Gemini (extracto del código real)
try:
    # Process the image to get bytes and mime type
    image_bytes, mime_type = self.process_image_to_bytes(image_path)
    
    # Prepare content parts
    contents = [
        # First part is the text prompt
        types.Part.from_text(text=self.question),
        # Second part is the image
        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
    ]
    
    with api_lock:
        # Use non-streaming API
        response = self._client.models.generate_content(
            model=self.model,
            contents=contents,
            config=self.get_generate_config()
        )
        description = response.text if hasattr(response, 'text') else str(response)
except Exception as e:
    error_msg = str(e)
    result["error"] = f"Error processing image with Gemini: {error_msg}"
```

Para gestionar las limitaciones de la API de Gemini (15 peticiones por minuto), implementamos un manejo cuidadoso del procesamiento por lotes en nuestro sistema `FileUtil`:

```python
# Extracto real de process_images en FileUtil
for batch_start in range(start_index, len(image_paths), self.batch_size):
    batch_end = min(batch_start + self.batch_size, len(image_paths))
    
    print(f"\nProcessing batch {batch_start//self.batch_size + 1} ({batch_end}/{len(image_paths)} images)")
    
    # Process each image in the batch
    for i, img_path in enumerate(batch):
        # Código de procesamiento de cada imagen...
    
    # Cooling period between batches, except if it's the last batch
    if batch_end < len(image_paths):
        print(f"\nCooling down for {self.cooling_period} seconds...")
        # Check for interruption during cooling every second
        for i in range(self.cooling_period):
            if interrupt_flag_file and os.path.exists(interrupt_flag_file):
                # Manejo de interrupción...
                pass
            time.sleep(1)
```

Este enfoque nos permite maximizar el uso de la API sin exceder sus límites, manteniendo un procesamiento eficiente y continuo.

### Desafíos técnicos y soluciones

Durante nuestras pruebas encontramos varios desafíos técnicos:

1. **Modelos que no responden la pregunta**: Algunos modelos de Ollama interpretaban el prompt como instrucciones sobre cómo responder, en lugar de responder a la pregunta. Esto se debe a problemas en el formato de las instrucciones y a limitaciones en la comprensión del contexto por parte de modelos más pequeños.
2. **Barrera del idioma**: Los modelos Moondream solo responden en inglés, lo que requirió implementar un sistema de post-procesamiento para traducir las respuestas al español.
3. **Precisión vs. velocidad**: Los modelos más precisos (Gemini) eran también los más rápidos, mientras que los modelos locales, a pesar de ser más lentos, producían respuestas menos precisas.
4. **Límites de API de Gemini**:
   * **Límite por minuto**: La API de Gemini permite solo 15 peticiones por minuto, lo que nos obligó a implementar períodos de enfriamiento considerables entre lotes para evitar errores. En nuestras pruebas, un enfriamiento de 30 segundos después de cada lote de 10 imágenes resultó óptimo.
   * **Límite diario**: Más allá del límite por minuto, existe un límite de 1500 peticiones diarias que representa una barrera significativa para proyectos a gran escala. En un contexto como el DOF, donde hemos identificado más de 4,000 imágenes tan solo en los documentos de los últimos 3 años, este límite resulta insuficiente.
   * **Volumen histórico**: Considerando que el DOF lleva en funcionamiento aproximadamente 20 años en formato digital, el volumen total estimado de imágenes podría superar las 25,000-30,000, lo que haría imposible un procesamiento completo con la API gratuita de Gemini en un tiempo razonable (requeriría más de 20 días dedicados exclusivamente a esta tarea).
5. **Gestión de fallos de API**: Implementamos mecanismos de checkpoint y recuperación para gestionar posibles fallos o interrupciones durante el procesamiento, lo que resulta crítico en procesos de larga duración con limitaciones de API.

Estos desafíos nos llevaron a considerar un enfoque híbrido, utilizando Gemini para documentos críticos donde la precisión es fundamental, y modelos locales para el procesamiento masivo inicial de documentos históricos, a pesar de su menor precisión.

Este enfoque híbrido, que está actualmente en fase de prototipo, se implementaría basado en la arquitectura actual de nuestro sistema, que sigue un patrón de diseño orientado a interfaces como se muestra en nuestro código:

```python
# Configuración de distintos modelos (basado en nuestro código real)
gemini_client = GeminiClient(
    model="gemini-2.0-flash",
    max_tokens=256,
    temperature=0.6,
    top_p=0.6,
    top_k=20,
    response_mime_type="text/plain",
    api_key=os.getenv("GEMINI_API_KEY")
)

ollama_client = OllamaClient(
    model="gemma3:4b",
    max_tokens=512,
    temperature=0.5,
    top_p=0.5,
    top_k=20,
    num_ctx=8192,
    api_key=None
)
```

La implementación de esta estrategia mixta nos permite optimizar el uso de recursos mientras cumplimos con los límites establecidos por las APIs de los servicios en la nube.

## Conclusiones: La IA y el arte de la "interpretación creativa"

Nuestras pruebas con sistemas de descripción automatizada de imágenes han evidenciado que, a pesar de los significativos avances en modelos multimodales, la fiabilidad y consistencia de estos sistemas continúa siendo un desafío notable en el estado actual de la tecnología.

Por una parte, Gemini demuestra capacidades impresionantes, generando descripciones rápidas, detalladas y con alta precisión semántica. Este rendimiento superior lo posiciona como la opción preferente para aplicaciones en producción donde la precisión y la eficiencia resultan críticas. Sin embargo, las limitaciones de su API (15 peticiones por minuto y especialmente el límite de 1500 peticiones diarias) representan un obstáculo significativo para proyectos a gran escala, como el procesamiento completo del archivo histórico del DOF con sus miles de imágenes acumuladas a lo largo de dos décadas.

En contraste, los modelos locales como los ejecutados a través de Ollama, a pesar de las ventajas inherentes a su independencia de servicios externos y no tener limitaciones de peticiones por minuto, presentan limitaciones sustanciales tanto en velocidad como en precisión interpretativa. Nuestros datos empíricos demuestran que estos modelos frecuentemente confabulan información inexistente o reinterpretan radicalmente los elementos visuales entre ejecuciones consecutivas.

Desde una perspectiva de implementación práctica, la decisión entre modelos en la nube o locales debe considerar cuidadosamente el equilibrio entre precisión, velocidad, límites de API y privacidad de datos. Para proyectos extensos como el nuestro, un enfoque híbrido parece ser la solución más viable: utilizar Gemini para documentos críticos o recientes donde la precisión es fundamental, complementado con modelos locales para el procesamiento masivo de archivos históricos donde podemos aceptar un margen de error mayor a cambio de superar las limitaciones de cuota.

Y, como nota final, permanece el enigma de qué mostraba realmente la imagen "\_page\_337\_Figure\_4.jpeg". ¿Contenía un conmovedor retrato de un niño en silla de ruedas? ¿Un sofisticado diagrama de flujo sobre desarrollo de software? ¿O quizás un documento gubernamental sobre garantías agrícolas para productores de maíz y frijol? La evidencia sugiere que la tercera opción es la correcta, pero resulta fascinante contemplar que, en el universo interpretativo de algunos modelos de IA, las tres realidades podrían coexistir simultáneamente en una suerte de superposición cuántica de significados visuales que solo la inteligencia artificial puede percibir.

***

*Este post forma parte de nuestro proyecto de extracción automática de descripciones de imágenes para documentos del Diario Oficial de la Federación. Para más información sobre la arquitectura y funcionamiento del sistema, consulta [nuestro repositorio](https://github.com/CodeandoGuadalajara/dof-rag).*
