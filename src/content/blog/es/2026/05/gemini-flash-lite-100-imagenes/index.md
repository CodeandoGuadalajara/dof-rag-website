---
title: "Gemini 2.5 Flash Lite en 100 imágenes del DOF: prueba a escala real"
date: 2026-05-16
author: Equipo DOF-RAG
description: >-
  Probamos Gemini 2.5 Flash Lite con el prompt v3 en 100 imágenes aleatorias
  del Diario Oficial de la Federación. Cero errores, 2.3s promedio por imagen,
  y un estimado de $41 USD para procesar las ~97,000 imágenes del corpus completo.
image: /images/posts/batch-100/ej11.png
tags:
  - DOF-RAG
  - IA
  - visión
  - Gemini
  - OpenRouter
  - RAG
  - captioning
featured: false
---

# Gemini 2.5 Flash Lite en 100 imágenes del DOF: prueba a escala real

En los dos posts anteriores ([comparación de 6 modelos](/es/blog/2026/05/batalla-modelos-vlm/) y [iteración del prompt v2](/es/blog/2026/05/vlm-prompt-v2/)) probamos modelos VLM con 14-15 imágenes curadas manualmente. Los resultados fueron útiles para elegir modelo y refinar el prompt, pero la muestra era pequeña y seleccionada a mano.

Esta vez hicimos algo distinto: tomamos **100 imágenes aleatorias** del corpus completo del DOF (~97,000 imágenes en documentos de 2001 a 2026) y las procesamos con un solo modelo — **Gemini 2.5 Flash Lite** — usando una versión actualizada del prompt (v3).

## ¿Qué cambió respecto al experimento anterior?

Aspecto | Posts anteriores | Este experimento |
---------|------------------|-------------------|
Imágenes | 14-15 seleccionadas manualmente | 100 aleatorias del corpus |
Modelos | 6 modelos comparados | Solo Gemini 2.5 Flash Lite |
Prompt | v1 (etiquetas) y v2 (párrafo) | v3 (v2 + instrucción de desajuste) |
Objetivo | Elegir modelo y prompt | Validar a escala real |

La nueva instrucción en el prompt v3 responde a un problema que detectamos al revisar documentos: a veces el texto que rodea una imagen en el markdown **no tiene nada que ver** con el contenido visual. Esto pasa porque el OCR/convertidor mezcla secciones o porque el documento original tenía imágenes insertadas en posiciones inconsistentes.

## Prompt v3

El prompt es igual al v2 con una instrucción adicional:

> Si el contexto del documento no parece relacionado con el contenido visual de la imagen, prioriza lo que ves en la imagen sobre el contexto.

El prompt completo:

<details>
<summary>Prompt v3 completo</summary>

> Eres un sistema de indexación para un motor RAG sobre documentos legales mexicanos (Diario Oficial de la Federación).
>
> Tu tarea es generar una descripción de esta imagen optimizada para búsqueda semántica. La imagen original estará disponible al generar la respuesta final, así que no describas aspectos visuales como colores, bordes o diseño.
>
> Si el contexto del documento incluye el título o caption de la figura (por ejemplo "FIGURA 1 Flexómetro"), úsalo como punto de partida — tiene más peso que tu interpretación visual.
>
> Si la imagen es ambigua o de baja resolución, infiere el contenido a partir del contexto del documento.
>
> Si el contexto del documento no parece relacionado con el contenido visual de la imagen, prioriza lo que ves en la imagen sobre el contexto.
>
> Escribe un párrafo continuo en español de 4 a 6 oraciones que incluya:
> - El tipo de imagen (tabla, diagrama, gráfica, mapa, logotipo, formato administrativo, etc.)
> - Los identificadores legales que aparezcan en la imagen o se infieran del contexto: número de artículo, fracción, NOM, decreto, ley, DOF, fecha, nombre de dependencia
> - Si no hay identificadores legales no menciones ninguno
> - Todo el contenido literal relevante: valores numéricos, rangos, categorías, claves, abreviaturas, nombres propios exactamente como aparecen
> - Los términos que un abogado, funcionario o investigador usaría para buscar este contenido
>
> No uses encabezados, etiquetas (TIPO:, CONTENIDO LITERAL:), viñetas, comillas ni markdown. Solo texto corrido.

</details>

## Metodología

1. Escaneamos 20,000 archivos markdown aleatorios (de ~658,000 en el corpus)
2. Encontramos 2,833 imágenes únicas mayores a 5KB (filtramos logos/iconos diminutos)
3. Seleccionamos 100 al azar (seed 42, reproducible)
4. Cada imagen se procesó con el contexto del markdown circundante (800 chars antes, 200 después)
5. Modelo: `google/gemini-2.5-flash-lite` vía OpenRouter
6. Parámetros: `max_tokens=512`, `temperature=0.1`

## Resultados generales

Métrica | Valor |
---------|-------|
Imágenes procesadas | 100 |
Tasa de éxito | 100% (0 errores) |
Tiempo promedio | 2.3s por imagen |
Tiempo mínimo | 1.1s |
Tiempo máximo | 6.7s |
Tokens input (total) | 214,411 |
Tokens output (total) | 17,122 |
Tokens output (promedio) | 171 por imagen |
Tamaño promedio imagen | 81 KB |

La corrida completa tomó **3.8 minutos** con un delay de 0.3s entre llamadas.

## Distribución del corpus

### Tipos de imagen

Clasificamos las 100 imágenes por tipo según el contenido del caption:

Tipo | Cantidad | Porcentaje |
------|----------|-----------|
Formatos administrativos | 26 | 26% |
Fotografías | 16 | 16% |
Diagramas de flujo | 13 | 13% |
Fórmulas matemáticas | 13 | 13% |
Tablas de datos | 11 | 11% |
Gráficas | 9 | 9% |
Logotipos institucionales | 8 | 8% |
Texto / extractos | 3 | 3% |
Mapas | 1 | 1% |

No es sorprendente: el DOF es mayormente documentos administrativos. Formatos, fotos de equipo y diagramas dominan el corpus.

### Por año

Año | Imágenes | Año | Imágenes |
-----|----------|-----|----------|
2007 | 1 | 2016 | 5 |
2008 | 1 | 2017 | 5 |
2009 | 5 | 2018 | 2 |
2010 | 10 | 2019 | 5 |
2011 | 11 | 2020 | 2 |
2012 | 3 | 2021 | 1 |
2013 | 9 | 2022 | 1 |
2014 | 23 | 2024 | 10 |
2015 | 5 | 2025 | 1 |

La concentración en 2014 (23 imágenes) refleja que ese año tuvo documentos particularmente ilustrados (NOMs, normativas técnicas).

## Tiempos por tamaño de imagen

Tamaño | Cantidad | Tiempo promedio |
--------|----------|-----------------|
Pequeñas (<30 KB) | 31 | 1.97s |
Medianas (30-100 KB) | 50 | 2.26s |
Grandes (≥100 KB) | 19 | 2.71s |

Las imágenes grandes tardan ~38% más, pero la correlación no es estricta. Algunas imágenes pequeñas con contenido complejo (diagramas densos, texto legal largo) fueron más lentas que imágenes grandes con contenido simple.

## Casos de desajuste contexto/imagen

La instrucción nueva del prompt v3 se activó en al menos 2 casos claros:

### Caso 1: Válvulas → Sedación paliativa

El contexto hablaba de válvulas de alivio de presión y especificaciones industriales. La imagen era un diagrama de flujo sobre algoritmo de sedación paliativa. El modelo describió correctamente la imagen visual, ignorando el contexto irrelevante.

![Diagrama de flujo — sedación paliativa](/images/posts/batch-100/ej11.png)

> Este es un diagrama de flujo que describe el algoritmo de sedación paliativa en el enfermo agónico. El diagrama detalla los pasos a seguir cuando un síntoma refractario no puede ser controlado adecuadamente, incluyendo la evaluación de otras opciones terapéuticas, el consenso médico, la información a la familia y la obtención del consentimiento informado antes de iniciar la sedación.

### Caso 2: Acopladores → Reporte financiero

El contexto hablaba de pernos de acoplador y especificaciones mecánicas. La imagen era un formato de rendimientos financieros del IMSS-Bienestar. De nuevo, el modelo identificó correctamente el contenido visual.

![Formato — rendimientos financieros](/images/posts/batch-100/ej12.png)

> Este documento es un formato administrativo titulado "ANEXO 7 REPORTE DE RENDIMIENTOS FINANCIEROS", correspondiente al Convenio CC-E001-2023-QROO-09, celebrado el 9 de octubre de 2023. El reporte detalla los rendimientos generados netos por la Secretaría de Finanzas y la Unidad Ejecutora...

Esto confirma que la instrucción funciona: cuando el contexto y la imagen no coinciden, el modelo se basa en lo que ve.

## Muestra de captions

Seleccionamos 15 ejemplos representativos de los 9 tipos de imagen que encontramos:

### Ejemplo 1: Formato administrativo — cobertura demográfica (Uruapan)

![Formato administrativo — cobertura demográfica (Uruapan)](/images/posts/batch-100/ej01.png)

> Esta imagen es un formato administrativo que detalla la cobertura demográfica y la población beneficiaria de un proyecto. Incluye secciones para el nombre de los territorios, como "Comunidades indígenas de Corupo, Angahuan, San Lorenzo, Capacuaro y Caltzontzin", y el tipo de población atendida, con opciones como "Población de mujeres" y "Población de hombres". También se especifica el grupo etario, con rangos como "7 a 11 años", "12 a 17 años", "18 a 30 años" y "30 a 59 años". Adicionalmente, se pregunta sobre la población en mayor situación de vulnerabilidad, ofreciendo categorías como "Niñas y adolescentes", "Adultas mayores", "Indígenas", "Madres jefas de familia" y "Víctimas de violencia". Este tipo de información es relevante para la planeación y evaluación de programas sociales, particularmente aquellos enfocados en la prevención de la violencia de género y feminicida, como se infiere del contexto del documento.

### Ejemplo 2: Diagrama de flujo — baja de activos financieros

![Diagrama de flujo — baja de activos financieros](/images/posts/batch-100/ej02.png)

> Este es un diagrama de flujo que describe el proceso de consolidación de subsidiarias y la posterior aplicación de criterios para la baja o mantenimiento de activos financieros. Se detallan preguntas clave sobre la expiración de derechos contractuales, la transferencia de estos derechos y la asunción de obligaciones, así como la transferencia o retención sustancial de riesgos y beneficios inherentes a un activo financiero. El diagrama hace referencia a párrafos específicos, como el 17, 18, 20(a), 21(a), 21(b), 22, 23(a), 23(b) y 23(c), que probablemente corresponden a secciones de una norma o regulación contable. Los resultados del proceso determinan si un activo financiero debe darse de baja o mantenerse en el balance, y en este último caso, por el monto que retenga una implicación económica o contractual. Este tipo de análisis es fundamental para la contabilidad financiera y la presentación de estados financieros, especialmente en el contexto de normativas como las Normas Internacionales de Información Financiera (NIIF) o regulaciones locales aplicables en México.

### Ejemplo 3: Mapa — distribución de especies marinas (Yucatán)

![Mapa — distribución de especies marinas (Yucatán)](/images/posts/batch-100/ej03.png)

> Este es un mapa que muestra la distribución de seis especies marinas en la península de Yucatán, Campeche y Quintana Roo. Las especies identificadas son E. morio, M. bonaci, M. microlepis, M. venenosa, E. guttatus y M. Tigris, cada una representada por un número del 1 al 6. La leyenda indica las combinaciones de números que aparecen en diferentes círculos sobre el mapa, sugiriendo la presencia de múltiples especies en esas áreas. El mapa es relevante para estudios de biodiversidad marina, pesquerías y ecología en el Golfo de México y el Mar Caribe.

### Ejemplo 4: Logotipo — Secretaría de Economía

![Logotipo — Secretaría de Economía](/images/posts/batch-100/ej04.png)

> Este es un logotipo institucional que muestra el Escudo Nacional de México y el texto "DIRECCION GENERAL DE COMERCIO EXTERIOR" junto con "SECRETARÍA DE ECONOMÍA" y las siglas "SE". La imagen representa la dependencia gubernamental encargada de las políticas de comercio exterior en México. Los términos de búsqueda relevantes incluyen: Dirección General de Comercio Exterior, Secretaría de Economía, SE, Escudo Nacional, comercio exterior, dependencia federal.

### Ejemplo 5: Fórmulas matemáticas — cálculo de pensiones

![Fórmulas matemáticas — cálculo de pensiones](/images/posts/batch-100/ej05.png)

> Esta imagen contiene fórmulas matemáticas y definiciones relacionadas con el cálculo de pensiones por viudez y orfandad, así como por viudez sin huérfanos, dentro del ámbito del Seguro de Vida. Se presentan ecuaciones para PBSV, que probablemente representa el Pago por Beneficio de Seguro de Vida, junto con definiciones de probabilidades de supervivencia y otros parámetros actuariales como Pk(s), Pk,u, y Ay. Las fórmulas utilizan notación matemática estándar, incluyendo sumatorias, multiplicaciones, exponentes y funciones de mínimo, y se refieren a conceptos como FA (Factor de Actualización), v (factor de descuento), y A, que podría ser una anualidad. El contenido es relevante para actuarios, analistas financieros y personal de seguros que trabajen con el cálculo de reservas y primas en el sector de seguros de vida en México.

### Ejemplo 6: Fotografía — chamarras SINAPROC

![Fotografía — chamarras SINAPROC](/images/posts/batch-100/ej06.png)

> Esta imagen muestra dos chamarras, una negra y otra guinda, ambas con bordados al frente que incluyen las leyendas "SEGURIDAD" y "SINAPROC", así como logotipos. En las mangas se aprecian el logotipo internacional de Protección Civil y la bandera de México. El contexto del documento legal especifica que estas chamarras son parte del equipamiento autorizado, junto con gorras, para la Secretaría de Seguridad Pública y Protección Civil (SSyPC) y el Sistema Nacional de Protección Civil (SINAPROC). La descripción es relevante para la búsqueda de normativas sobre uniformes, equipamiento de protección civil y la identificación de personal de seguridad y emergencias en México.

### Ejemplo 7: Fotografía — camioneta SINAPROC

![Fotografía — camioneta SINAPROC](/images/posts/batch-100/ej07.jpeg)

> Esta imagen muestra una camioneta Mercedes-Benz Sprinter, utilizada como unidad móvil. La unidad está rotulada con el logotipo de "SINAPROC" en colores verde y dorado, y la bandera de México. La descripción del documento indica que la impresión se realiza con tintas UV sobre vinil 3M automotriz, con cortes de vinil reflejante para los logotipos y la bandera. Este tipo de vehículo y su rotulación son relevantes para la logística y operación de programas de protección civil o asistencia, como los que podría operar el Sistema Nacional de Protección Civil (SINAPROC).

### Ejemplo 8: Gráfica de líneas — biomasa y CPUE (mero)

![Gráfica de líneas — biomasa y CPUE (mero)](/images/posts/batch-100/ej08.png)

> Esta imagen es una gráfica que muestra la evolución de la biomasa y la CPUE (Captura por Unidad de Esfuerzo) en kilogramos de mero por viaje a lo largo de los años. Se presentan dos series de datos: la biomasa en miles de toneladas, representada por puntos negros con forma de rombo, y la CPUE, que se divide en observada (círculos blancos) y estimada (línea continua negra). La gráfica abarca el periodo de 1970 a 2010, con el eje horizontal indicando los años y los ejes verticales mostrando los valores de biomasa y CPUE. Se observa una línea horizontal roja punteada que representa un umbral de 50,000 toneladas de biomasa. Los términos clave para la búsqueda son biomasa, CPUE, mero, captura por unidad de esfuerzo, índice de abundancia, y los rangos de años y valores mostrados.

### Ejemplo 9: Gráfica de barras — proporción de captura por especie

![Gráfica de barras — proporción de captura por especie](/images/posts/batch-100/ej09.png)

> Esta imagen es una gráfica de barras que muestra la proporción de captura de escama por especie. Las especies listadas son Mojarra (1%), Curvina (1%), Chucumite (1%), Robalo (3%), Gurrubata (4%), Sargo (4%), Trucha (4%), Lebrancha (21%) y Lisa (61%). Estos datos son relevantes para estudios de pesca, acuacultura y manejo de recursos marinos en México, y podrían ser referenciados en normativas o reportes de dependencias como la CONAPESCA o la SEMARNAT. La información presentada es crucial para entender la distribución y abundancia de especies de escama en cuerpos de agua específicos, como se infiere del contexto del documento.

### Ejemplo 10: Tabla — destino geográfico de inversión extranjera

![Tabla — destino geográfico de inversión extranjera](/images/posts/batch-100/ej10.png)

> Esta es una tabla del Diario Oficial de la Federación que solicita información sobre el destino geográfico de la inversión extranjera. La tabla se titula "DESTINO GEOGRÁFICO DE LA INVERSIÓN" y se divide en secciones para registrar los recursos destinados a la creación de una planta, oficina, establecimiento o infraestructura sin operación, y aquellos que ya se encuentran en operación. Se solicitan montos y porcentajes que representan del total para cada entidad federativa, incluyendo Aguascalientes, Baja California, Baja California Sur, Campeche, Coahuila, Colima, Chiapas, Chihuahua, Distrito Federal, Durango, Estado de México, Guanajuato, Guerrero, Hidalgo, Jalisco, Michoacán, Morelos, Nayarit, Nuevo León, Oaxaca, Puebla, Querétaro, Quintana Roo, San Luis Potosí, Sinaloa, Sonora, Tabasco, Tamaulipas, Tlaxcala, Veracruz, Yucatán y Zacatecas. Al final se incluye un apartado para el total y observaciones. El documento pertenece a la Secretaría de Economía y tiene el código BE-02-001-8.

### Ejemplo 11: Diagrama de flujo — algoritmo de sedación paliativa *(desajuste contexto/imagen)*

![Diagrama de flujo — algoritmo de sedación paliativa](/images/posts/batch-100/ej11.png)

> Este es un diagrama de flujo que describe el algoritmo de sedación paliativa en el enfermo agónico. El diagrama detalla los pasos a seguir cuando un síntoma refractario no puede ser controlado adecuadamente, incluyendo la evaluación de otras opciones terapéuticas, el consenso médico, la información a la familia y la obtención del consentimiento informado antes de iniciar la sedación. La fuente citada es el Grupo de trabajo de Tratamientos del Programa Regional de Cuidados Paliativos del Servicio Extremeño de Salud, en colaboración con la Sociedad Española de Cuidados Paliativos, con fecha de 2004. Este tipo de algoritmo es relevante para la práctica clínica en cuidados paliativos y la toma de decisiones éticas en pacientes terminales.

### Ejemplo 12: Formato — reporte de rendimientos financieros *(desajuste contexto/imagen)*

![Formato — reporte de rendimientos financieros](/images/posts/batch-100/ej12.png)

> Este documento es un formato administrativo titulado "ANEXO 7 REPORTE DE RENDIMIENTOS FINANCIEROS", correspondiente al Convenio CC-E001-2023-QROO-09, celebrado el 9 de octubre de 2023. El reporte detalla los rendimientos generados netos por la Secretaría de Finanzas y la Unidad Ejecutora, con un apartado para el monto total acumulable. Se especifica que este anexo forma parte de un convenio de coordinación en materia de transferencia de recursos presupuestarios federales como subsidios para el "HOSPITAL IMSS-BIENESTAR NICOLÁS BRAVO", con cargo al Programa Presupuestario E001 "ATENCIÓN A LA SALUD DE PERSONAS SIN SEGURIDAD SOCIAL" para el ejercicio fiscal 2023, entre Servicios de Salud del Instituto Mexicano del Seguro Social para el Bienestar y el Ejecutivo del Estado Libre y Soberano de Quintana Roo. El formato incluye campos para la Entidad Federativa, Fecha, Meses (Mes 1, Mes 2, Mes 3), Monto Total Acumulable, y las firmas de Elaboró, Revisó y Autorizó, con sus respectivos cargos.

### Ejemplo 13: Diagrama técnico — dimensiones de estribo vehicular

![Diagrama técnico — dimensiones de estribo vehicular](/images/posts/batch-100/ej13.png)

> Este es un diagrama técnico que ilustra las dimensiones y especificaciones de instalación de un estribo, probablemente para un vehículo o equipo de transporte. Se especifican varias medidas críticas, incluyendo una distancia mínima de 1.27 cm para la fijación con tornillos o remaches, una altura libre de 53.34 cm o más que requiere un peldaño adicional, una distancia mínima de 20.32 cm desde un punto de referencia, y un rango de 25.40 cm mínimo a 30.48 cm máximo para otra dimensión. Estas especificaciones son relevantes para normativas de seguridad y diseño, como las que se encuentran en el Diario Oficial de la Federación (DOF) o en Normas Oficiales Mexicanas (NOM) relacionadas con la accesibilidad y la construcción de vehículos.

### Ejemplo 14: Tabla de coordenadas — expropiación Tren Maya

![Tabla de coordenadas — expropiación Tren Maya](/images/posts/batch-100/ej14.png)

> Este es un cuadro de construcción de polígono que detalla la afectación a la parcela 64 "B", incluyendo coordenadas Y y X, rumbos y distancias. Los datos corresponden a la expropiación de tierras para el ejido "El Faisán" en Tenosique, Tabasco, con una superficie total de 00-12-30.362 hectáreas. La tabla presenta una serie de puntos (PV) con sus coordenadas y las medidas de los lados (LADO EST) que forman el polígono, con valores numéricos y direcciones cardinales. Este tipo de información es crucial para estudios catastrales, de topografía y de derecho agrario en México.

### Ejemplo 15: Gráfica de radar — indicadores de bienestar social

![Gráfica de radar — indicadores de bienestar social](/images/posts/batch-100/ej15.png)

> Este es un diagrama de radar que compara indicadores de bienestar social a nivel estatal y nacional. Los ejes del diagrama representan "Rezago educativo", "Acceso a los servicios de salud", "Acceso a la seguridad social", "Calidad y espacios en la vivienda", "Servicios básicos en la vivienda" y "Acceso a la alimentación". Las líneas gris y negra indican los valores estatales y nacionales, respectivamente, para cada uno de estos indicadores. Los valores numéricos en el eje vertical van de 0.0 a 75.0, mostrando la magnitud de cada indicador. Este tipo de gráfico es útil para visualizar comparaciones multidimensionales y evaluar el desempeño en políticas públicas de desarrollo social.

## Estimación de costo para el corpus completo

Con los promedios de esta corrida:

Concepto | Valor |
----------|-------|
Input tokens promedio | 2,144 por imagen |
Output tokens promedio | 171 por imagen |
Costo directo (Gemini pricing) | ~$41 USD |
Costo vía OpenRouter (1.5x) | ~$62 USD |

**$41-62 USD para procesar las ~97,000 imágenes del corpus completo.** Eso es extremadamente accesible.

### Tiempo estimado

Modo | Workers | Tiempo estimado |
------|---------|-----------------|
Secuencial | 1 | ~60 horas |
Paralelo | 10 | ~6 horas |
Paralelo | 20 | ~3 horas |

Con 20 workers concurrentes (que ya probamos en `enrich_markdown_images.py`), el corpus completo se procesa en una tarde.

## Observaciones

**Calidad consistente.** Los captions son informativos y en español en los 100 casos. Los más cortos (87 tokens) describen logos o formatos simples; los más largos (379 tokens) detallan formatos administrativos complejos con campos específicos. El modelo adapta la longitud al contenido.

**Tendencia a sobre-describir.** Algunos captions listan los 32 estados mexicanos o los 30 campos de un formulario. Para búsqueda/RAG esto no necesariamente es malo (más términos indexables), pero genera tokens extra.

**Cero alucinaciones detectadas.** Revisamos una muestra y no encontramos información fabricada. Los nombres de dependencias, números de convenio y tipos de documento coinciden con lo que se ve en las imágenes.

**Contexto genérico no es problema.** 6 imágenes tenían contexto que era solo enlaces a otras imágenes (`![](media/...)`) o delimitadores de tabla. Aún así el modelo produjo captions correctos basándose solo en la imagen.

## ¿Qué sigue?

1. **Corrida completa.** Ejecutar `enrich_markdown_images.py` con el prompt v3 sobre las ~97,000 imágenes del corpus usando 20 workers. Costo estimado: ~$62 USD, tiempo: ~3 horas.

2. **Validación humana.** Muestrear ~50 captions del corpus completo para verificar calidad a escala.

3. **Integración con RAG.** Los captions se inyectan como comentarios HTML en los markdown (`<!-- IMAGE_DESCRIPTION: ... -->`), listos para que el chunker los incluya en los vectores de embeddings.

---

*Script: `vlm_batch_100.py` en [PR #53](https://github.com/CodeandoGuadalajara/dof-rag/pull/53). Datos completos: `vlm_batch_100_results.json`.*