---
title: "Gemini 2.5 Flash Lite on 100 DOF images: a real-world scale test"
date: 2026-05-16
author: DOF-RAG Team
description: >-
  We tested Gemini 2.5 Flash Lite with the v3 prompt on 100 random images from
  the Official Journal of the Federation. Zero errors, 2.3s average per image,
  and an estimated $41 USD to process the ~97,000 images in the full corpus.
image: /images/posts/batch-100/ej11.png
tags:
  - DOF-RAG
  - AI
  - vision
  - Gemini
  - OpenRouter
  - RAG
  - captioning
featured: false
---

# Gemini 2.5 Flash Lite on 100 DOF images: a real-world scale test

In the two previous posts ([comparison of 6 models](/en/blog/2026/05/batalla-modelos-vlm/) and [prompt v2 iteration](/en/blog/2026/05/vlm-prompt-v2/)), we tested VLM models on 14–15 manually curated images. The results were useful for choosing a model and refining the prompt, but the sample was small and hand-picked.

This time we did something different: we took **100 random images** from the full Official Journal of the Federation (DOF) corpus (~97,000 images across documents from 2001 to 2026) and processed them with a single model — **Gemini 2.5 Flash Lite** — using an updated version of the prompt (v3).

## What changed compared to the previous experiment?

Aspect | Previous posts | This experiment |
---------|----------------|-----------------|
Images | 14–15 hand-selected | 100 random from the corpus |
Models | 6 models compared | Only Gemini 2.5 Flash Lite |
Prompt | v1 (tags) and v2 (paragraph) | v3 (v2 + mismatch instruction) |
Goal | Choose model and prompt | Validate at real-world scale |

The new instruction in prompt v3 responds to a problem we noticed while reviewing documents: sometimes the text surrounding an image in the markdown **has nothing to do** with the visual content. This happens because the OCR/converter mixes sections or because the original document inserted images in inconsistent positions.

## Prompt v3

The prompt is the same as v2 with one additional instruction:

> Si el contexto del documento no parece relacionado con el contenido visual de la imagen, prioriza lo que ves en la imagen sobre el contexto.

The full prompt:

<details>
<summary>Full prompt v3</summary>

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

## Methodology

1. We scanned 20,000 random markdown files (from ~658,000 in the corpus).
2. We found 2,833 unique images larger than 5KB (filtering tiny logos/icons).
3. We selected 100 at random (seed 42, reproducible).
4. Each image was processed with the surrounding markdown context (800 chars before, 200 after).
5. Model: `google/gemini-2.5-flash-lite` via OpenRouter.
6. Parameters: `max_tokens=512`, `temperature=0.1`.

## Overall results

Metric | Value |
---------|-------|
Images processed | 100 |
Success rate | 100% (0 errors) |
Average time | 2.3s per image |
Minimum time | 1.1s |
Maximum time | 6.7s |
Input tokens (total) | 214,411 |
Output tokens (total) | 17,122 |
Input tokens (average) | 2,144 per image |
Output tokens (average) | 171 per image |
Average image size | 81 KB |

The full run took **3.8 minutes** with a 0.3s delay between calls.

### Why 2,144 input tokens?

The input cost is significantly higher than our initial estimate of 800 tokens. Breaking down an average call:
- **Image:** ~1,500–1,800 tokens. Gemini uses a "tiles" system to process images; even though the file is small (81KB), resolution can drive the token count up.
- **Prompt:** ~300 tokens.
- **Context:** ~250 tokens (1,000 characters of surrounding text).

This means that 70–80% of the processing cost is the image itself. Optimizing the prompt would save little; the key to scalability is the model's vision price per million tokens.

## Corpus distribution

### Image types

We classified the 100 images by type based on the caption content:

Type | Count | Percentage |
------|----------|-----------|
Administrative forms | 26 | 26% |
Photographs | 16 | 16% |
Flowcharts | 13 | 13% |
Mathematical formulas | 13 | 13% |
Data tables | 11 | 11% |
Charts | 9 | 9% |
Institutional logos | 8 | 8% |
Text / excerpts | 3 | 3% |
Maps | 1 | 1% |

It's no surprise: the DOF is mostly administrative documents. Forms, equipment photos, and flowcharts dominate the corpus.

### By year

Year | Images | Year | Images |
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

The concentration in 2014 (23 images) reflects that this year had particularly illustrated documents (NOMs, technical regulations). Although it is a random sample, for the full run we should monitor whether the distribution of image types varies drastically across decades, since the DOF's publication format has evolved.

### The formula challenge (13%)

We found that 13% of the corpus consists of mathematical formulas. While the model generates a useful narrative description for general searches (e.g., "pension calculation formula"), a user searching for a specific formula by its variables will not find it. For that 13% of the corpus, it may be worth using a specialized prompt that instructs the model to transcribe the exact mathematical notation in LaTeX or plain text.

## Times by image size

Size | Count | Average time |
--------|----------|-----------------|
Small (<30 KB) | 31 | 1.97s |
Medium (30–100 KB) | 50 | 2.26s |
Large (≥100 KB) | 19 | 2.71s |

Large images take ~38% longer, but the correlation is not strict. Some small images with complex content (dense diagrams, long legal text) were slower than large images with simple content.

## Context/image mismatch cases

The new instruction in prompt v3 was triggered in at least 2 clear cases:

### Case 1: Valves → Palliative sedation

The context discussed pressure-relief valves and industrial specifications. The image was a flowchart about a palliative sedation algorithm. The model correctly described the visual image, ignoring the irrelevant context.

![Flowchart — palliative sedation](/images/posts/batch-100/ej11.png)

> Este es un diagrama de flujo que describe el algoritmo de sedación paliativa en el enfermo agónico. El diagrama detalla los pasos a seguir cuando un síntoma refractario no puede ser controlado adecuadamente, incluyendo la evaluación de otras opciones terapéuticas, el consenso médico, la información a la familia y la obtención del consentimiento informado antes de iniciar la sedación.

### Case 2: Couplers → Financial report

The context discussed coupler bolts and mechanical specifications. The image was an IMSS-Bienestar financial returns form. Again, the model correctly identified the visual content.

![Form — financial returns](/images/posts/batch-100/ej12.png)

> Este documento es un formato administrativo titulado "ANEXO 7 REPORTE DE RENDIMIENTOS FINANCIEROS", correspondiente al Convenio CC-E001-2023-QROO-09, celebrado el 9 de octubre de 2023. El reporte detalla los rendimientos generados netos por la Secretaría de Finanzas y la Unidad Ejecutora...

This confirms the instruction works: when context and image do not match, the model relies on what it sees.

## Caption sample

We selected 15 representative examples from the 9 image types we found:

### Example 1: Administrative form — demographic coverage (Uruapan)

![Administrative form — demographic coverage (Uruapan)](/images/posts/batch-100/ej01.png)

> Esta imagen es un formato administrativo que detalla la cobertura demográfica y la población beneficiaria de un proyecto. Incluye secciones para el nombre de los territorios, como "Comunidades indígenas de Corupo, Angahuan, San Lorenzo, Capacuaro y Caltzontzin", y el tipo de población atendida, con opciones como "Población de mujeres" y "Población de hombres". También se especifica el grupo etario, con rangos como "7 a 11 años", "12 a 17 años", "18 a 30 años" y "30 a 59 años". Adicionalmente, se pregunta sobre la población en mayor situación de vulnerabilidad, ofreciendo categorías como "Niñas y adolescentes", "Adultas mayores", "Indígenas", "Madres jefas de familia" y "Víctimas de violencia". Este tipo de información es relevante para la planeación y evaluación de programas sociales, particularmente aquellos enfocados en la prevención de la violencia de género y feminicida, como se infiere del contexto del documento.

### Example 2: Flowchart — derecognition of financial assets

![Flowchart — derecognition of financial assets](/images/posts/batch-100/ej02.png)

> Este es un diagrama de flujo que describe el proceso de consolidación de subsidiarias y la posterior aplicación de criterios para la baja o mantenimiento de activos financieros. Se detallan preguntas clave sobre la expiración de derechos contractuales, la transferencia de estos derechos y la asunción de obligaciones, así como la transferencia o retención sustancial de riesgos y beneficios inherentes a un activo financiero. El diagrama hace referencia a párrafos específicos, como el 17, 18, 20(a), 21(a), 21(b), 22, 23(a), 23(b) y 23(c), que probablemente corresponden a secciones de una norma o regulación contable. Los resultados del proceso determinan si un activo financiero debe darse de baja o mantenerse en el balance, y en este último caso, por el monto que retenga una implicación económica o contractual. Este tipo de análisis es fundamental para la contabilidad financiera y la presentación de estados financieros, especialmente en el contexto de normativas como las Normas Internacionales de Información Financiera (NIIF) o regulaciones locales aplicables en México.

### Example 3: Map — distribution of marine species (Yucatán)

![Map — distribution of marine species (Yucatán)](/images/posts/batch-100/ej03.png)

> Este es un mapa que muestra la distribución de seis especies marinas en la península de Yucatán, Campeche y Quintana Roo. Las especies identificadas son E. morio, M. bonaci, M. microlepis, M. venenosa, E. guttatus y M. Tigris, cada una representada por un número del 1 al 6. La leyenda indica las combinaciones de números que aparecen en diferentes círculos sobre el mapa, sugiriendo la presencia de múltiples especies en esas áreas. El mapa es relevante para estudios de biodiversidad marina, pesquerías y ecología en el Golfo de México y el Mar Caribe.

### Example 4: Logo — Secretariat of Economy

![Logo — Secretariat of Economy](/images/posts/batch-100/ej04.png)

> Este es un logotipo institucional que muestra el Escudo Nacional de México y el texto "DIRECCION GENERAL DE COMERCIO EXTERIOR" junto con "SECRETARÍA DE ECONOMÍA" y las siglas "SE". La imagen representa la dependencia gubernamental encargada de las políticas de comercio exterior en México. Los términos de búsqueda relevantes incluyen: Dirección General de Comercio Exterior, Secretaría de Economía, SE, Escudo Nacional, comercio exterior, dependencia federal.

### Example 5: Mathematical formulas — pension calculation

![Mathematical formulas — pension calculation](/images/posts/batch-100/ej05.png)

> Esta imagen contiene fórmulas matemáticas y definiciones relacionadas con el cálculo de pensiones por viudez y orfandad, así como por viudez sin huérfanos, dentro del ámbito del Seguro de Vida. Se presentan ecuaciones para PBSV, que probablemente representa el Pago por Beneficio de Seguro de Vida, junto con definiciones de probabilidades de supervivencia y otros parámetros actuariales como Pk(s), Pk,u, y Ay. Las fórmulas utilizan notación matemática estándar, incluyendo sumatorias, multiplicaciones, exponentes y funciones de mínimo, y se refieren a conceptos como FA (Factor de Actualización), v (factor de descuento), y A, que podría ser una anualidad. El contenido es relevante para actuarios, analistas financieros y personal de seguros que trabajen con el cálculo de reservas y primas en el sector de seguros de vida en México.

### Example 6: Photograph — SINAPROC jackets

![Photograph — SINAPROC jackets](/images/posts/batch-100/ej06.png)

> Esta imagen muestra dos chamarras, una negra y otra guinda, ambas con bordados al frente que incluyen las leyendas "SEGURIDAD" y "SINAPROC", así como logotipos. En las mangas se aprecian el logotipo internacional de Protección Civil y la bandera de México. El contexto del documento legal especifica que estas chamarras son parte del equipamiento autorizado, junto con gorras, para la Secretaría de Seguridad Pública y Protección Civil (SSyPC) y el Sistema Nacional de Protección Civil (SINAPROC). La descripción es relevante para la búsqueda de normativas sobre uniformes, equipamiento de protección civil y la identificación de personal de seguridad y emergencias en México.

### Example 7: Photograph — SINAPROC van

![Photograph — SINAPROC van](/images/posts/batch-100/ej07.jpeg)

> Esta imagen muestra una camioneta Mercedes-Benz Sprinter, utilizada como unidad móvil. La unidad está rotulada con el logotipo de "SINAPROC" en colores verde y dorado, y la bandera de México. La descripción del documento indica que la impresión se realiza con tintas UV sobre vinil 3M automotriz, con cortes de vinil reflejante para los logotipos y la bandera. Este tipo de vehículo y su rotulación son relevantes para la logística y operación de programas de protección civil o asistencia, como los que podría operar el Sistema Nacional de Protección Civil (SINAPROC).

### Example 8: Line chart — biomass and CPUE (grouper)

![Line chart — biomass and CPUE (grouper)](/images/posts/batch-100/ej08.png)

> Esta imagen es una gráfica que muestra la evolución de la biomasa y la CPUE (Captura por Unidad de Esfuerzo) en kilogramos de mero por viaje a lo largo de los años. Se presentan dos series de datos: la biomasa en miles de toneladas, representada por puntos negros con forma de rombo, y la CPUE, que se divide en observada (círculos blancos) y estimada (línea continua negra). La gráfica abarca el periodo de 1970 a 2010, con el eje horizontal indicando los años y los ejes verticales mostrando los valores de biomasa y CPUE. Se observa una línea horizontal roja punteada que representa un umbral de 50,000 toneladas de biomasa. Los términos clave para la búsqueda son biomasa, CPUE, mero, captura por unidad de esfuerzo, índice de abundancia, y los rangos de años y valores mostrados.

### Example 9: Bar chart — catch proportion by species

![Bar chart — catch proportion by species](/images/posts/batch-100/ej09.png)

> Esta imagen es una gráfica de barras que muestra la proporción de captura de escama por especie. Las especies listadas son Mojarra (1%), Curvina (1%), Chucumite (1%), Robalo (3%), Gurrubata (4%), Sargo (4%), Trucha (4%), Lebrancha (21%) y Lisa (61%). Estos datos son relevantes para estudios de pesca, acuacultura y manejo de recursos marinos en México, y podrían ser referenciados en normativas o reportes de dependencias como la CONAPESCA o la SEMARNAT. La información presentada es crucial para entender la distribución y abundancia de especies de escama en cuerpos de agua específicos, como se infiere del contexto del documento.

### Example 10: Table — geographic destination of foreign investment

![Table — geographic destination of foreign investment](/images/posts/batch-100/ej10.png)

> Esta es una tabla del Diario Oficial de la Federación que solicita información sobre el destino geográfico de la inversión extranjera. La tabla se titula "DESTINO GEOGRÁFICO DE LA INVERSIÓN" y se divide en secciones para registrar los recursos destinados a la creación de una planta, oficina, establecimiento o infraestructura sin operación, y aquellos que ya se encuentran en operación. Se solicitan montos y porcentajes que representan del total para cada entidad federativa, incluyendo Aguascalientes, Baja California, Baja California Sur, Campeche, Coahuila, Colima, Chiapas, Chihuahua, Distrito Federal, Durango, Estado de México, Guanajuato, Guerrero, Hidalgo, Jalisco, Michoacán, Morelos, Nayarit, Nuevo León, Oaxaca, Puebla, Querétaro, Quintana Roo, San Luis Potosí, Sinaloa, Sonora, Tabasco, Tamaulipas, Tlaxcala, Veracruz, Yucatán y Zacatecas. Al final se incluye un apartado para el total y observaciones. El documento pertenece a la Secretaría de Economía y tiene el código BE-02-001-8.

### Example 11: Flowchart — palliative sedation algorithm *(context/image mismatch)*

![Flowchart — palliative sedation algorithm](/images/posts/batch-100/ej11.png)

> Este es un diagrama de flujo que describe el algoritmo de sedación paliativa en el enfermo agónico. El diagrama detalla los pasos a seguir cuando un síntoma refractario no puede ser controlado adecuadamente, incluyendo la evaluación de otras opciones terapéuticas, el consenso médico, la información a la familia y la obtención del consentimiento informado antes de iniciar la sedación. La fuente citada es el Grupo de trabajo de Tratamientos del Programa Regional de Cuidados Paliativos del Servicio Extremeño de Salud, en colaboración con la Sociedad Española de Cuidados Paliativos, con fecha de 2004. Este tipo de algoritmo es relevante para la práctica clínica en cuidados paliativos y la toma de decisiones éticas en pacientes terminales.

### Example 12: Form — financial returns report *(context/image mismatch)*

![Form — financial returns report](/images/posts/batch-100/ej12.png)

> Este documento es un formato administrativo titulado "ANEXO 7 REPORTE DE RENDIMIENTOS FINANCIEROS", correspondiente al Convenio CC-E001-2023-QROO-09, celebrado el 9 de octubre de 2023. El reporte detalla los rendimientos generados netos por la Secretaría de Finanzas y la Unidad Ejecutora, con un apartado para el monto total acumulable. Se especifica que este anexo forma parte de un convenio de coordinación en materia de transferencia de recursos presupuestarios federales como subsidios para el "HOSPITAL IMSS-BIENESTAR NICOLÁS BRAVO", con cargo al Programa Presupuestario E001 "ATENCIÓN A LA SALUD DE PERSONAS SIN SEGURIDAD SOCIAL" para el ejercicio fiscal 2023, entre Servicios de Salud del Instituto Mexicano del Seguro Social para el Bienestar y el Ejecutivo del Estado Libre y Soberano de Quintana Roo. El formato incluye campos para la Entidad Federativa, Fecha, Meses (Mes 1, Mes 2, Mes 3), Monto Total Acumulable, y las firmas de Elaboró, Revisó y Autorizó, con sus respectivos cargos.

### Example 13: Technical diagram — vehicle step dimensions

![Technical diagram — vehicle step dimensions](/images/posts/batch-100/ej13.png)

> Este es un diagrama técnico que ilustra las dimensiones y especificaciones de instalación de un estribo, probablemente para un vehículo o equipo de transporte. Se especifican varias medidas críticas, incluyendo una distancia mínima de 1.27 cm para la fijación con tornillos o remaches, una altura libre de 53.34 cm o más que requiere un peldaño adicional, una distancia mínima de 20.32 cm desde un punto de referencia, y un rango de 25.40 cm mínimo a 30.48 cm máximo para otra dimensión. Estas especificaciones son relevantes para normativas de seguridad y diseño, como las que se encuentran en el Diario Oficial de la Federación (DOF) o en Normas Oficiales Mexicanas (NOM) relacionadas con la accesibilidad y la construcción de vehículos.

### Example 14: Coordinate table — Tren Maya expropriation

![Coordinate table — Tren Maya expropriation](/images/posts/batch-100/ej14.png)

> Este es un cuadro de construcción de polígono que detalla la afectación a la parcela 64 "B", incluyendo coordenadas Y y X, rumbos y distancias. Los datos corresponden a la expropiación de tierras para el ejido "El Faisán" en Tenosique, Tabasco, con una superficie total de 00-12-30.362 hectáreas. La tabla presenta una serie de puntos (PV) con sus coordenadas y las medidas de los lados (LADO EST) que forman el polígono, con valores numéricos y direcciones cardinales. Este tipo de información es crucial para estudios catastrales, de topografía y de derecho agrario en México.

### Example 15: Radar chart — social well-being indicators

![Radar chart — social well-being indicators](/images/posts/batch-100/ej15.png)

> Este es un diagrama de radar que compara indicadores de bienestar social a nivel estatal y nacional. Los ejes del diagrama representan "Rezago educativo", "Acceso a los servicios de salud", "Acceso a la seguridad social", "Calidad y espacios en la vivienda", "Servicios básicos en la vivienda" y "Acceso a la alimentación". Las líneas gris y negra indican los valores estatales y nacionales, respectivamente, para cada uno de estos indicadores. Los valores numéricos en el eje vertical van de 0.0 a 75.0, mostrando la magnitud de cada indicador. Este tipo de gráfico es útil para visualizar comparaciones multidimensionales y evaluar el desempeño en políticas públicas de desarrollo social.

## Cost estimate for the full corpus

Using the averages from this run:

Item | Value |
----------|-------|
Average input tokens | 2,144 per image |
Average output tokens | 171 per image |
Direct cost (Gemini pricing) | ~$41 USD |
Cost via OpenRouter (1.5x) | ~$62 USD |

**$41–62 USD to process the ~97,000 images in the full corpus.** That's extremely affordable.

### Estimated time

Mode | Workers | Estimated time |
------|---------|-----------------|
Sequential | 1 | ~60 hours |
Parallel | 10 | ~6 hours |
Parallel | 20 | ~3 hours |

With 20 concurrent workers (which we already tested in `enrich_markdown_images.py`), the full corpus can be processed in an afternoon.

## Observations

**Consistent quality.** The captions are informative and in Spanish in all 100 cases. The shortest (87 tokens) describe logos or simple forms; the longest (379 tokens) detail complex administrative forms with specific fields. The model adapts length to content.

**Tendency to over-describe.** Some captions list all 32 Mexican states or all 30 fields of a form. For search/RAG this adds indexable terms, but if that information already exists in the surrounding text (which is already in the chunk), we are duplicating data and increasing token cost without adding real value. A future prompt improvement (v4) could instruct: *"Do not list elements that already appear in the surrounding document text"*.

**No obvious hallucinations.** In the cases we could manually verify against the visible image content, we found no fabricated information. Agency names, agreement numbers, and document types match what is visible in the images. However, for scientific validation we would need a more extensive ground-truth dataset.

**Generic context is not a problem.** Six images had context that was only links to other images (`![](media/...)`) or table delimiters. The model still produced correct captions based solely on the image.

## What's next?

Before proceeding with the bulk processing of the ~97,000 images, the 100-image experiment forces us to make a strategic pause to ensure retrieval quality:

1. **Specific validation of critical types:** Generic human validation is not enough. We will run a retrieval test on the two most frequent and problematic types:
   - **Administrative forms (26%):** Verify whether a user searching for a specific field (e.g., "Convenio CC-E001") finds the document through the caption.
   - **Mathematical formulas (13%):** Determine whether the narrative description is sufficient or whether we should implement the LaTeX-specialized prompt for this subset.

2. **Prompt refinement (v4):** Add the instruction to avoid duplicate information ("Do not list elements that already appear in the surrounding text") to optimize cost and the semantic relevance of the vectors.

3. **Full run:** Once the critical types are validated and the prompt is refined, we will run `enrich_markdown_images.py` on the full corpus. With the efficiency improvements from prompt v4, we expect to keep the cost below $60 USD.

---

*Script: `vlm_batch_100.py` in [PR #53](https://github.com/CodeandoGuadalajara/dof-rag/pull/53). Complete data: `vlm_batch_100_results.json`.*
