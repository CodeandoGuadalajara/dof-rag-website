---
title: "Iterating the prompt: second round of VLM model comparison"
date: 2026-05-14
author: DOF-RAG Team
description: >-
  Second iteration of the experiment: we changed the prompt, adjusted the test
  images, and replaced Qwen with Grok and Gemma. We compared 6 models on 14
  images from the Official Journal of the Federation (DOF).
image: /images/posts/model-comparison/img21.png
tags:
  - DOF-RAG
  - AI
  - vision
  - models
  - comparison
  - OpenRouter
  - prompt
featured: false
---

# Iterating the prompt: second round of VLM model comparison

In the [previous post](/en/blog/2026/05/batalla-modelos-vlm/) we compared 6 VLM models using a prompt with explicit labels (TYPE:, LEGAL IDENTIFIERS:, LITERAL CONTENT:, SEARCH VOCABULARY:). The results were useful, but the responses had a repetitive format that is not ideal for semantic search.

This time we iterated on three fronts: the prompt, the test images, and the models.

## What changed?

| Aspect | v1 (previous post) | v2 (this experiment) |
|--------|------------------|----------------------|
| Prompt | Explicit labels (TYPE:, CONTENT:) | Continuous paragraph, no labels |
| Images | 15 (included logo, small formulas) | 14 (removed logo and formulas, added org chart and NOM) |
| Models | qwen3.6-flash, qwen3.5-flash-02-23 | grok-4.1-fast, gemma-4-31b-it |

### Image changes

- **Removed**: img04 (IFE logo redundant with img03), img09 and img10 (tiny, low-resolution math formulas)
- **Added**: img21 (org chart of the Superior Audit of the Federation, 165KB) and img22 (technical diagram NOM-011-ENER-2024, 374KB)

### Model changes

We replaced the Qwen models because in v1 their responses were practically identical to one another and to Gemini's, contributing no diversity. We now tested **Grok** (x-ai) and **Gemma** (Google) as options from different providers.

## The v2 prompt

> Eres un sistema de indexación para un motor RAG sobre documentos legales mexicanos (Diario Oficial de la Federación).
>
> Tu tarea es generar una descripción de esta imagen optimizada para búsqueda semántica. La imagen original estará disponible al generar la respuesta final, así que no describas aspectos visuales como colores, bordes o diseño.
>
> Si el contexto del documento incluye el título o caption de la figura (por ejemplo "FIGURA 1 Flexómetro"), úsalo como punto de partida — tiene más peso que tu interpretación visual.
>
> Si la imagen es ambigua o de baja resolución, infiere el contenido a partir del contexto del documento.
>
> Escribe un párrafo continuo en español de 4 a 6 oraciones que incluya:
> - El tipo de imagen (tabla, diagrama, gráfica, mapa, logotipo, formato administrativo, etc.)
> - Los identificadores legales que aparezcan en la imagen o se infieran del contexto: número de artículo, fracción, NOM, decreto, ley, DOF, fecha, nombre de dependencia
> - Si no hay identificadores legales no menciones ninguno
> - Todo el contenido literal relevante: valores numéricos, rangos, categorías, claves, abreviaturas, nombres propios exactamente como aparecen
> - Los términos que un abogado, funcionario o investigador usaría para buscar este contenido
>
> No uses encabezados, etiquetas (TIPO:, CONTENIDO LITERAL:), viñetas, comillas ni markdown. Solo texto corrido.

Key changes vs. v1:

- **No labels**: we directly asked for a continuous paragraph of 4–6 sentences
- **Figure caption use**: if the context includes “FIGURA 1 Flexómetro,” use that title as a starting point
- **Explicit inference**: if the image is ambiguous, infer from the document context
- **No identifiers if there are none**: do not force mentions of articles if they do not appear
- **4–6 sentences** (previously 4–8): more concise

## Response times and costs

| Model | Average | Min | Max | Total | Input $/M tok | Output $/M tok | Cost 14 imgs | Cost 98k imgs |
|--------|---------|-----|-----|-------|---------------|----------------|--------------|---------------|
| gemini-2.5-flash-lite | 2.1s | 1.3s | 3.4s | 28.9s | $0.10 | $0.40 | $0.0023 | ~$16 |
| gemini-3.1-flash-lite | 2.8s | 1.7s | 6.3s | 39.7s | $0.25 | $1.50 | $0.0084 | ~$59 |
| gpt-5.4-nano | 3.7s | 1.9s | 5.9s | 52.1s | $0.20 | $1.25 | $0.0073 | ~$51 |
| claude-3-haiku | 3.7s | 2.4s | 5.4s | 52.1s | $0.25 | $1.25 | $0.0065 | ~$45 |
| gemma-4-31b-it | 11.4s | 6.0s | 20.6s | 160.1s | $0.12 | $0.37 | $0.0026 | ~$18 |
| grok-4.1-fast | 15.7s | 7.4s | 24.3s | 219.4s | $0.20 | $0.50 | $0.0043 | ~$30 |

Prices from [OpenRouter](https://openrouter.ai/models?input_modalities=image&output_modalities=text&max_price=0.25&order=most-popular) at the time of the experiment. Costs estimated assuming ~950 input tokens per call (prompt + context + image) and output tokens estimated from the responses. 0 errors in 84 calls.

Gemini 2.5 Flash Lite is the fastest and cheapest. Gemma 4 is the second-cheapest option but 5× slower. Grok is the slowest by a wide margin.

## The results — image by image

### img01.png — Technical diagram of mechanical components (tape measure)

![Technical diagram of mechanical components (tape measure)](/images/posts/model-comparison/img01.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** the v2 prompt (see above).

**Document context:**

> lece en 7.1.
>
> **5.2** Exactitud de la cinta
>
> Las líneas que indiquen las divisiones de la cinta deben ser como máximo de 0,40 mm de ancho, perpendiculares al eje longitudinal de la cinta, ser claras, exactas y resistentes al uso. La longitud de las líneas deben ser variables en razón directa del valor mayor que limitan las unidades con números de orden indicados con caracteres arábigos, por lo menos para los decímetros y unidades mayores. Las cintas tipo 1 deben subdividirse en milímetros en toda su extensión; las cintas tipo 2, deben subdividirse por lo menos en decímetros y el primer decímet

</details>

<details>
<summary><strong>Responses from each model</strong></summary>

**gemini-3.1-flash-lite** (6.3s):

Esta imagen consiste en un diagrama técnico que ilustra la configuración física de una cinta métrica, conforme a las especificaciones de exactitud y diseño establecidas en el apartado 5.2 del documento normativo. El esquema representa dos vistas de un instrumento de medición de longitud, detallando la estructura de la cinta enrollada y el mecanismo de sujeción o carcasa. Este contenido es fundamental para la interpretación de las normas técnicas sobre instrumentos de medición, específicamente en lo relativo a la subdivisión de escalas en milímetros y decímetros para cintas tipo 1 y tipo 2. La representación gráfica sirve como referencia visual para los requisitos de diseño, exactitud y marcado de las divisiones perpendiculares al eje longitudinal de la cinta. Los investigadores y funcionarios pueden utilizar esta figura para verificar el cumplimiento de los estándares de fabricación y precisión exigidos en la normativa vigente sobre dispositivos de medición lineal.


**gemini-2.5-flash-lite** (1.6s):

Este es un diagrama que ilustra las especificaciones técnicas de una cinta métrica, detallando la exactitud y las divisiones de la cinta. Se describen las características de las líneas de medición, como su ancho máximo de 0.40 mm y su perpendicularidad al eje longitudinal. Se especifican las subdivisiones de las cintas tipo 1 y tipo 2, indicando que las cintas tipo 1 deben subdividirse en milímetros en toda su extensión, mientras que las cintas tipo 2 deben subdividirse al menos en decímetros, con el primer decímetro subdividido en milímetros. La información es relevante para normativas de metrología y especificaciones de instrumentos de medición.


**gpt-5.4-nano** (5.1s):

La imagen corresponde a un diagrama esquemático de cintas de medición donde se señalan las partes relevantes para evaluar exactitud, en particular la traza y las líneas que indican las divisiones de la cinta, con énfasis en su forma y posición respecto al eje longitudinal. En el contexto del documento, el contenido técnico se refiere a que las líneas divisorias deben ser como máximo de 0,40 mm de ancho, perpendiculares al eje longitudinal, claras, exactas y resistentes al uso, y que su longitud debe ser variable en razón directa del valor mayor que limitan. Además, se establece que las cintas tipo 1 deben subdividirse en milímetros en toda su extensión, mientras que las cintas tipo 2 deben subdividirse por lo menos en decímetros y el primer decímetro subdividido en milímetros, conforme a las tolerancias de longitud y la carga a que debe sujetarse. El material se relaciona con el apartado 5.2 Exactitud de la cinta, por lo que es un referente visual para buscar especificaciones de metrología de cintas y requisitos de las marcas o divisiones de la cinta.


**grok-4.1-fast** (12.5s):

Diagrama esquemático que ilustra la estructura de una cinta métrica desenrollada desde su rollo con flecha indicadora y un sello rectangular de verificación con muesca y protuberancia. Representa las divisiones de la cinta conforme a la sección 5.2 Exactitud de la cinta, donde las líneas deben tener un máximo de 0,40 mm de ancho, ser perpendiculares al eje longitudinal, claras, exactas y resistentes al uso. Muestra subdivisiones en milímetros para cintas tipo 1 en toda su extensión y para tipo 2 al menos en decímetros con el primer decímetro en milímetros, con longitudes de líneas variables en razón directa del valor mayor y números arábigos para decímetros y unidades mayores. Incluye referencias a tolerancias de longitud y carga de sujeción. Términos clave para búsqueda legal incluyen exactitud de cinta métrica, divisiones milimétricas, flexómetro tipo 1 y tipo 2, normas de medición lineal en DOF.


**gemma-4-31b-it** (7.4s):

Esta imagen es un diagrama técnico que representa un flexómetro o cinta métrica. El contenido se relaciona con las especificaciones de exactitud de la cinta detalladas en el apartado 5.2 del documento. El esquema muestra la estructura del dispositivo de medición, incluyendo el carrete y la cinta extensible. Los términos técnicos relevantes para la búsqueda incluyen cintas tipo 1, cintas tipo 2, subdivisiones en milímetros y decímetros, y tolerancias de longitud. Este diagrama sirve como referencia visual para los estándares de medición y las características físicas de las líneas de división mencionadas en la normativa.


**claude-3-haiku** (3.5s):

La imagen muestra un diagrama que representa una cinta métrica o flexómetro. Según el contexto del documento, esta imagen se relaciona con la Norma Oficial Mexicana NOM-EE-001-SCFI-2017, que establece los requisitos y especificaciones técnicas que deben cumplir las cintas métricas o flexómetros utilizados en México. El diagrama ilustra los requisitos de exactitud de las líneas que indican las divisiones de la cinta, como el ancho máximo de 0.40 mm, la perpendicularidad al eje longitudinal y la claridad y resistencia al uso. Además, se menciona que las líneas deben tener longitudes variables de acuerdo al valor de las unidades indicadas con números arábigos, al menos para decímetros y unidades mayores. Este tipo de información sería relevante para que abogados, funcionarios o investigadores puedan buscar y acceder a los requisitos técnicos establecidos en la norma para este tipo de instrumentos de medición.


</details>

---

### img02.png — Technical diagram of a mechanical component

![Technical diagram of a mechanical component](/images/posts/model-comparison/img02.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** the v2 prompt (see above).

**Document context:**

> erpendiculares al eje longitudinal de la cinta, ser claras, exactas y resistentes al uso. La longitud de las líneas deben ser variables en razón directa del valor mayor que limitan las unidades con números de orden indicados con caracteres arábigos, por lo menos para los decímetros y unidades mayores. Las cintas tipo 1 deben subdividirse en milímetros en toda su extensión; las cintas tipo 2, deben subdividirse por lo menos en decímetros y el primer decímetro subdividido en milímetros, tanto las tolerancias de longitud como la carga a que debe sujetarse la cinta para medir su exactitud se indic

</details>

<details>
<summary><strong>Responses from each model</strong></summary>

**gemini-3.1-flash-lite** (2.1s):

Esta imagen corresponde a un diagrama técnico que ilustra un flexómetro con cinta métrica, conforme a lo establecido en la normativa técnica sobre instrumentos de medición. La figura representa esquemáticamente el mecanismo de enrollado y la estructura física del dispositivo utilizado para mediciones de longitud. El contenido gráfico sirve como referencia visual para la clasificación de cintas métricas tipo 1 y tipo 2, las cuales deben cumplir con especificaciones de subdivisión en milímetros y decímetros según el contexto legal. Este diagrama es fundamental para la interpretación de los requisitos de exactitud, tolerancias de longitud y métodos de comprobación descritos en la norma. La representación técnica facilita la identificación de los componentes del instrumento para investigadores y funcionarios encargados de la verificación de instrumentos de medición.


**gemini-2.5-flash-lite** (1.3s):

La figura 1 muestra un flexómetro con cinta métrica, un instrumento de medición esencial para la verificación de la exactitud de las cintas métricas. El flexómetro, también conocido como cinta métrica retráctil, se utiliza para medir longitudes y se caracteriza por tener líneas claras, exactas y resistentes al uso, dispuestas perpendicularmente al eje longitudinal de la cinta. Las subdivisiones de la cinta, ya sean en milímetros para cintas tipo 1 o en decímetros y milímetros para cintas tipo 2, son cruciales para la precisión de las mediciones. Las tolerancias de longitud y la carga de prueba para determinar la exactitud se especifican en la tabla 1, un detalle importante para cualquier profesional que requiera mediciones fiables.


**gpt-5.4-nano** (5.9s):

La imagen corresponde a una figura técnica, tipo diagrama/representación esquemática, rotulada como FIGURA 1 Flexómetro con cinta métrica, utilizada para ilustrar las partes y el funcionamiento del flexómetro con cinta métrica. En el contexto del documento se describe la necesidad de que las líneas o marcas sean claras, exactas y resistentes al uso, y que su longitud sea variable en razón directa del valor mayor que limitan, con unidades que deben llevar números de orden con caracteres arábigos al menos para los decímetros y unidades mayores. También se indica que las cintas tipo 1 deben subdividirse en milímetros en toda su extensión, mientras que las cintas tipo 2 deben subdividirse por lo menos en decímetros y que el primer decímetro debe subdividirse en milímetros. El mismo apartado remite a las tolerancias de longitud y a la carga con la que debe sujetarse la cinta para medir su exactitud, las cuales se señalan en la tabla 1 y se comprueban conforme a 7.1.


**grok-4.1-fast** (7.4s):

Diagrama esquemático de la FIGURA 1 Flexómetro con cinta métrica, que ilustra la estructura de una cinta métrica enrollada en un casing circular con mango y gancho terminal, junto a una vista desplegada mostrando subdivisiones lineales. Representa cintas tipo 1 subdivididas en milímetros en toda su extensión y cintas tipo 2 subdivididas al menos en decímetros con el primer decímetro en milímetros, con líneas perpendiculares al eje longitudinal claras y exactas marcadas con números arábigos para decímetros y unidades mayores. Incluye referencia a la tabla 1 para tolerancias de longitud y carga de verificación según el apartado 7.1. Este diagrama detalla requisitos de resistencia al uso y exactitud para instrumentos de medición en normativas mexicanas de verificación metrológica. Términos clave incluyen flexómetro, cinta métrica, subdivisiones métricas, tolerancias de longitud y comprobación de exactitud.


**gemma-4-31b-it** (16.7s):

Esta imagen es un diagrama técnico que representa un flexómetro con cinta métrica. De acuerdo con la Figura 1 del documento, el esquema muestra la vista frontal y lateral de un dispositivo de medición lineal. El contenido se relaciona con las especificaciones técnicas de cintas tipo 1 y tipo 2, enfocándose en la subdivisión de milímetros y decímetros. Este recurso es fundamental para el cumplimiento de las tolerancias de longitud y la carga de exactitud mencionadas en la tabla 1 y el apartado 7.1. Un investigador o funcionario buscaría este contenido mediante términos como instrumentos de medición, metrología legal, cinta métrica y especificaciones técnicas de flexómetros.


**claude-3-haiku** (3.5s):

La imagen muestra un diagrama de un flexómetro con cinta métrica. Según el contexto, esta figura se titula "FIGURA 1 Flexómetro con cinta métrica" y forma parte de una norma oficial mexicana que establece los requisitos para las cintas métricas, incluyendo las tolerancias de longitud y la carga a la que deben someterse para comprobar su exactitud. El diagrama ilustra las características de las líneas perpendiculares al eje longitudinal de la cinta, que deben ser claras, exactas y resistentes al uso, con longitudes variables de acuerdo al valor mayor que limitan las unidades indicadas con números arábigos. Este tipo de imagen sería relevante para abogados, funcionarios o investigadores que trabajen con normatividad metrológica mexicana, especialmente aquella relacionada con instrumentos de medición como flexómetros y cintas métricas.


</details>

---
### img03.png — Federal Electoral Institute (IFE) Logo

![Federal Electoral Institute (IFE) Logo](/images/posts/model-comparison/img03.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** prompt v2 (see above).

**Document context:**

> l 25 de mayo de 1999, de manera que el Instituto Federal Electoral esté en aptitud de suscribir convenios de apoyo y colaboración directamente con las Agrupaciones Políticas Nacionales. En todo caso, dichos convenios tendrán que ser aprobados con anterioridad por la Comisión de Capacitación Electoral y Educación Cívica.
>
> **CUARTO.-** Notifíquese por oficio el presente Acuerdo a las Agrupaciones Políticas Nacionales.
>
> **QUINTO.-** Publíquese el presente Acuerdo en el **Diario Oficial de la Federación**.
>
> El presente acuerdo fue aprobado en sesión extraordinaria del Consejo General celebrada el

</details>

<details>
<summary><strong>Model responses</strong></summary>

**gemini-3.1-flash-lite** (4.1s):

Esta imagen corresponde al logotipo institucional del Instituto Federal Electoral, identificado comúnmente por sus siglas IFE. El emblema representa la autoridad administrativa encargada de la organización de los procesos electorales federales en México, conforme a las facultades otorgadas por la legislación electoral vigente en el periodo de su emisión. Este distintivo aparece en documentos oficiales, acuerdos del Consejo General y convenios de colaboración suscritos por el organismo. La presencia de este logotipo valida la autenticidad de los actos administrativos publicados en el Diario Oficial de la Federación, como el acuerdo aprobado el 16 de diciembre de 2004 bajo la presidencia de Luis Carlos Ugalde Ramírez. Su inclusión en expedientes legales permite a investigadores y funcionarios identificar la procedencia institucional de las disposiciones normativas y acuerdos de capacitación electoral y educación cívica.


**gemini-2.5-flash-lite** (1.7s):

Este es un logotipo del Instituto Federal Electoral (IFE). El logotipo muestra un rombo naranja sobre una línea horizontal gris, seguido de las letras "IFE" en mayúsculas negras. Debajo de las letras, se lee el nombre completo "INSTITUTO FEDERAL ELECTORAL" en mayúsculas. Este logotipo se asocia con la institución encargada de organizar las elecciones federales en México, y su aparición en el Diario Oficial de la Federación indica la publicación de acuerdos o normativas relacionadas con su funcionamiento o con las agrupaciones políticas nacionales. La imagen representa la identidad visual de una dependencia gubernamental clave en el ámbito electoral mexicano.


**gpt-5.4-nano** (3.7s):

La imagen corresponde a un logotipo institucional del Instituto Federal Electoral (IFE), con la leyenda IFE e Instituto Federal Electoral. En el contexto del documento, el logotipo se utiliza para identificar la autoridad responsable que emite y suscribe un acuerdo publicado en el Diario Oficial de la Federación, relacionado con la aptitud para suscribir convenios de apoyo y colaboración con Agrupaciones Políticas Nacionales, sujetándolo a aprobación previa por la Comisión de Capacitación Electoral y Educación Cívica. El texto asociado indica que el acuerdo fue aprobado en sesión extraordinaria del Consejo General celebrada el 16 de diciembre de 2004 y que se ordena su notificación por oficio y su publicación en el Diario Oficial de la Federación. También se menciona al Consejero Presidente del Consejo General, Luis Carlos Ugalde Ramírez.


**grok-4.1-fast** (11.1s):

Logotipo oficial del Instituto Federal Electoral (IFE) que muestra el acrónimo IFE junto al nombre completo INSTITUTO FEDERAL ELECTORAL. Se integra en el contexto de un Acuerdo del Consejo General del IFE aprobado en sesión extraordinaria el 16 de diciembre de 2004 y publicado en el Diario Oficial de la Federación. El acuerdo regula la suscripción de convenios de apoyo y colaboración con Agrupaciones Políticas Nacionales, aprobados previamente por la Comisión de Capacitación Electoral y Educación Cívica, con notificación por oficio y publicación en DOF. Firmado por el Consejero Presidente Luis Carlos Ugalde Ramírez. Términos clave para búsqueda incluyen logotipo IFE, Acuerdo Consejo General IFE 2004, convenios Agrupaciones Políticas Nacionales y DOF electoral.


**gemma-4-31b-it** (6.0s):

Esta imagen es un logotipo institucional del Instituto Federal Electoral. El contenido literal muestra las siglas IFE y el nombre completo Instituto Federal Electoral. El elemento gráfico se vincula con un Acuerdo aprobado en sesión extraordinaria del Consejo General el 16 de diciembre de 2004 y publicado en el Diario Oficial de la Federación. Esta imagen es relevante para búsquedas relacionadas con la autoridad electoral mexicana, convenios con Agrupaciones Políticas Nacionales y la gestión de Luis Carlos Ugalde Ramírez. Es un identificador visual de la dependencia administrativa encargada de la organización de procesos electorales federales en el periodo mencionado.


**claude-3-haiku** (2.7s):

La imagen muestra el logotipo del Instituto Federal Electoral (IFE) de México. El logotipo consiste en un triángulo amarillo con el texto "IFE" en letras negras. Este logotipo es utilizado por el organismo electoral federal mexicano, responsable de organizar y supervisar los procesos electorales en el país. El contexto del documento indica que este acuerdo del Consejo General del IFE se publicó en el Diario Oficial de la Federación, la gaceta oficial del gobierno mexicano. Un investigador o funcionario público interesado en temas electorales y de derecho administrativo mexicano podría buscar este logotipo y contenido relacionado con las atribuciones y actividades del Instituto Federal Electoral.


</details>

---

### img05.png — Comparative Bar Chart (Domestic Market)

![Comparative Bar Chart (Domestic Market)](/images/posts/model-comparison/img05.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** prompt v2 (see above).

**Document context:**

> e fugas.
>
> **7.2.6.2** Del recipiente portátil.
>
> No debe haber fugas de gas en ningún punto de la unión de la válvula del recipiente con la tubería flexible del calefactor.
>
> **7.3** Estabilidad del aparato, dispositivos de fijación y desplazamiento.
>
> **7.3.1** Fundamento.
>
> Este método de prueba tiene como objeto verificar que los calefactores de ambiente cubiertos por esta Norma pueden ser operados de manera fácil y segura cuando están instalados, en caso de aparatos fijos o cuando están en movimiento, en caso de los aparatos móviles.
>
> **7.3.2** Reactivos y materiales.
>
> - Recipiente portátil
>
> -

</details>

<details>
<summary><strong>Model responses</strong></summary>

**gemini-3.1-flash-lite** (1.9s):

Esta imagen consiste en dos gráficas de barras comparativas que ilustran la relación entre el mercado interno, la producción y las exportaciones de China. El contenido visual presenta categorías específicas etiquetadas como Consumo interno, Producción y Exportaciones de China, destacando un volumen significativamente mayor en el rubro de exportaciones. Este material gráfico se integra en el análisis de mercado y comercio exterior relacionado con la regulación de calefactores de ambiente bajo la normativa técnica correspondiente. Los investigadores y funcionarios pueden utilizar esta representación para evaluar la balanza comercial y la dinámica de suministro de productos manufacturados en el contexto de las disposiciones del Diario Oficial de la Federación. La comparación visual permite identificar la dependencia de los mercados externos frente a la capacidad de producción y consumo doméstico.


**gemini-2.5-flash-lite** (1.5s):

Este es un diagrama de barras que compara el consumo interno, la producción y las exportaciones de China dentro del mercado interno. Se presentan dos gráficos idénticos, cada uno mostrando tres barras que representan estas categorías. Las barras de "Consumo interno" y "Producción" son significativamente más bajas que la barra de "Exportaciones de China", lo que indica una diferencia sustancial en estas métricas. La línea vertical azul en cada gráfico podría representar un punto de referencia o un umbral. Este tipo de información es relevante para análisis de mercado, comercio internacional y políticas económicas.


**gpt-5.4-nano** (2.9s):

La imagen corresponde a una gráfica comparativa de barras sobre mercado interno y exportaciones, con dos paneles que muestran el mismo esquema. En ambos paneles aparece Mercado interno en el eje superior y, en la base, las categorías Consumo interno, Producción y Exportaciones de China, además de una barra destacada para el mercado interno. Al ubicarse en el contexto del capítulo 7.2.6.2 Del recipiente portátil y la subsección 7.3 sobre estabilidad del aparato, la gráfica parece utilizada para apoyar un análisis o consideración del contexto de operación/uso, aunque no se identifican números ni identificadores legales específicos como artículos, fracciones, NOM o DOF dentro de la imagen. Se repiten exactamente las etiquetas Mercado interno, Consumo interno, Producción y Exportaciones de China, que serían términos clave para búsquedas relacionadas con consumo, producción y exportaciones de China.


**grok-4.1-fast** (14.9s):

Gráficas de barras horizontales idénticas en dos paneles que representan la distribución del mercado interno, con ejes categorizados en Consumo interno, Producción y Exportaciones de China. En cada gráfica, el Consumo interno muestra una barra azul baja, la Producción una barra azul mínima casi nula y las Exportaciones de China una barra azul alta dominante que ocupa la mayor parte del espacio visual. Ilustran la preponderancia de las exportaciones hacia China sobre el consumo y producción locales en el mercado interno. Términos clave incluyen mercado interno, consumo interno, producción, exportaciones de China, distribución porcentual implícita por barras y análisis de mercado en contextos normativos mexicanos.


**gemma-4-31b-it** (12.8s):

Esta imagen consiste en dos gráficas de barras comparativas que analizan el mercado interno. El contenido literal muestra categorías de Consumo interno, Producción y Exportaciones de China. Las gráficas representan visualmente la disparidad entre el consumo y la producción nacional frente al volumen de las exportaciones provenientes de China. Aunque el contexto textual menciona la figura 1 relacionada con una cuña de madera para pruebas de estabilidad, la imagen muestra datos comerciales. Un investigador o funcionario buscaría este contenido mediante términos como balance comercial, importaciones chinas, capacidad de producción nacional y análisis de mercado interno.


**claude-3-haiku** (3.8s):

La imagen muestra dos gráficos de barras que comparan el mercado interno y la producción de China en términos de consumo interno, producción y exportaciones de China. Los gráficos no contienen identificadores legales específicos, pero el contexto del documento indica que se trata de una norma oficial mexicana (NOM) relacionada con calefactores de ambiente. Los términos clave que un abogado, funcionario o investigador utilizaría para buscar este contenido serían: mercado interno, producción, exportaciones, consumo interno, calefactores de ambiente, NOM.


</details>

---

### img06.png — Expense Certification Form (Health Caravans)

![Expense Certification Form (Health Caravans)](/images/posts/model-comparison/img06.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** prompt v2 (see above).

**Document context:**

> valor total de la producción de las empresas beneficiarias del cupo en los tres años calendario anteriores al inicial del periodo de vigencia del cupo para el cual solicita asignación, ponderada por 0.35; más
>
> > c. La participación del valor de las inversiones en activos fijos realizadas en México por cada empresa, en el valor total de las inversiones de las empresas beneficiarias del cupo en los tres años calendario anteriores al inicial del periodo de vigencia del cupo para el cual solicita asignación, ponderado por 0.20.
>
> > Todo lo anterior multiplicado por el monto del cupo total del perio

</details>

<details>
<summary><strong>Model responses</strong></summary>

**gemini-3.1-flash-lite** (2.7s):

Este documento es un formato administrativo oficial denominado Formato de Certificación de Gasto para Gastos de Operación, correspondiente al Anexo 4 del Programa Caravanas de la Salud de la Dirección General de Planeación y Desarrollo en Salud de la Secretaría de Salud para el ejercicio 2014. El formulario incluye campos específicos para la comprobación de recursos públicos como entidad federativa, concepto de gasto, monto, partida específica, número de factura pagada, póliza cheque, modalidad de adquisición, contrato o pedido, proveedor o prestador de servicios e importe total acumulado. El formato integra una leyenda legal sobre el cumplimiento de requisitos fiscales, administrativos y normativos vigentes conforme al convenio de coordinación y transferencia de recursos. Se incluyen espacios para firmas de validación bajo los cargos de quien elaboró, el Director de Administración y el Secretario de Salud. Este instrumento es fundamental para la rendición de cuentas, fiscalización de recursos federales y auditoría administrativa en programas de salud pública.


**gemini-2.5-flash-lite** (2.1s):

Este es un formato administrativo de la Dirección General de Planeación y Desarrollo en Salud, correspondiente al Programa Caravanas de la Salud, Ejercicio 2014. El documento se titula "Formato de Certificación de Gasto para 'Gastos de Operación'" y se identifica como Anexo 4. Incluye campos para la Entidad Federativa, Concepto de Gasto de Aplicación, Nombre del Concepto de Gasto, Monto por concepto de gasto, y Fecha de elaboración. La tabla principal detalla Partida Específica, Número Factura Pagada, Póliza Cheque, Fecha Pol-Cheque, Mod. Adquisición, Contrato o Pedido, Proveedor o Prestador de Servicios, Importe y Observaciones, con un campo de Total Acumulado. Al final, se incluye una declaración sobre la documentación comprobatoria y los espacios para Elaboró, Autorizó (Director de Administración), Vo. Bo. (Secretario de Salud) y MES. Este formato es relevante para la certificación de gastos operativos en programas de salud federales y estatales.


**gpt-5.4-nano** (3.1s):

La imagen es un formato administrativo de certificación de gasto denominado Formato de Certificación de Gasto para “GASTOS DE OPERACIÓN”, identificado como ANEXO 4 del Programa de Carrera de la Salud EJCERCICIO 2014, correspondiente a la Dirección General de Planeación y Desarrollo en Salud, Secretaría de Salud. Incluye campos para la Entidad Federativa, el Monto por concepto de gasto, el Concepto de Gasto de Aplicación y la Fecha de elaboración, además de una sección de captura de datos de comprobación con Partida Específica, Número Factura Pagada, Póliza Cheque, Fecha Pol-Cheque, Mod. Adquisición, Contrato Pedido, Proveedor o Prestador de Servicios, Importe y Observaciones, con un TOTAL ACUMULADO y Monto total por concepto de gasto. También incorpora apartados de elaboración y autorización con las leyendas Elaboró, Autorizó, Vo. Bo. y roles como Director de Administración y Secretario de Salud, así como el campo MES. El pie de documento indica que la documentación original debe comprobarse conforme a los requisitos fiscales, administrativos y normativos vigentes vinculados al programa y que está sujeta a disposición de la Secretaría de Salud para revisión, corrección o ajustes.


**grok-4.1-fast** (24.3s):

Formato administrativo de certificación de gastos de operación identificado como ANEXO 4 de la Dirección General de Planeación y Desarrollo en Salud de la Secretaría de Salud, con campos numerados para registro detallado de comprobantes fiscales y administrativos. Incluye secciones para Entidad Federativa, monto de gasto, concepto de gasto o aplicación, nombre del concepto de gasto, fecha de elaboración, y una tabla con columnas como Número Factura Pagada, Póliza Cheque, Fecha P/Chque, Mod Adquisición, Contrato o Pedido, Proveedor o Prestador de Servicios, Importe, Observaciones y Total Acumulado. Requiere documentación original comprobatoria conforme a requisitos fiscales, administrativos y normativos vigentes en el programa, con espacios para Elaboró, Autorizó por Director de Administración, Vo.Bo. por Secretario de Salud y MES. Este formulario soporta la justificación de gastos en programas de salud federales, incluyendo ponderaciones de producción e inversiones para asignación de cupos. Términos clave para búsqueda incluyen certificación ANEXO 4 gastos operación Secretaría de Salud, formato comprobantes fiscales proveedores, total acumulado importes cheques y autorización director administración.


**gemma-4-31b-it** (10.6s):

Este formato administrativo corresponde al Anexo 4 denominado Formato de Certificación de Gasto para Gastos de Operación del Programa Caravanas de la Salud para el ejercicio 2014 de la Secretaría de Salud. El documento incluye campos para capturar la Entidad Federativa, el Monto por concepto de gasto, el Concepto de Gasto de Aplicación, el Nombre del Concepto de Gasto y la Fecha de elaboración. Contiene una tabla detallada con columnas para Partida Específica, Número Factura Pagada, Póliza Cheque, Fecha Pol-Cheque, Mod. Adquisición, Contrato o Pedido, Proveedor o Prestador de Servicios, Importe y Observaciones, finalizando con un espacio para el Total Acumulado. El formato requiere las firmas de quien Elaboró, quien Autorizó como Director de Administración y el Vo. Bo. del Secretario de Salud, incluyendo un campo para el mes. Este documento es fundamental para la comprobación fiscal, administrativa y normativa de los recursos asignados a programas de salud pública federales.


**claude-3-haiku** (5.4s):

Esta imagen representa un formato de certificación de gasto para "Gastos de Operación" del Programa Caravanas de la Salud, ejercicio 2014, emitido por la Dirección General de Planeación y Desarrollo en Salud de la Secretaría de Salud.

El formato incluye campos para registrar la Entidad Federativa, el Concepto de Gasto de Aplicación, la Fecha de Elaboración, así como diversos detalles de la operación como Partida Específica, Número de Factura Pagada, Póliza de Cheque, Fecha de Póliza-Cheque, Modalidad de Adquisición, Contrato o Pedido, Proveedor o Prestador de Servicios, Importe y Observaciones. Al final se indica el Total Acumulado.

Este documento sería relevante para búsquedas relacionadas con programas y gastos de la Secretaría de Salud, normativa sobre comprobación de recursos públicos, y procesos administrativos y contables de las Caravanas de la Salud en 2014.


</details>

---
### img07.png — National Hydrocarbons Commission (CNH) Tables

![National Hydrocarbons Commission (CNH) Tables](/images/posts/model-comparison/img07.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** prompt v2 (see above).

**Document context:**

> e Acuerdo se substanciarían conforme a las disposiciones vigentes al inicio del trámite respectivo.
>
> Ciudad de México, a 12 de diciembre de 2019.- Comisionados Integrantes del Órgano de Gobierno de la Comisión Nacional de Hidrocarburos.- El Comisionado Presidente, **Rogelio Hernández Cázares**.- Rúbrica.- Los Comisionados: **Alma América Porres Luna**, **Sergio Henrivier Pimentel Vargas**, **Néstor Martínez Romero**, **Héctor Moreira Rodríguez**.- Rúbricas.
>
> Formato PAGNA
>
> Parte 1 de 18 Características y componentes
>
> Parte 4 de 18 Responsable Oficial
>
> Parte 13 de 18 Censo de equipos
>
> _________

</details>

<details>
<summary><strong>Responses from each model</strong></summary>

**gemini-3.1-flash-lite** (2.7s):

This document presents three official administrative formats of the National Hydrocarbons Commission identified as Part 16 of 18 Activity and Investment, Part 17 of 18 Evaluation, and Part 18 of 18 Maximum RGA. The first format is a table for the breakdown of investment in millions of pesos that includes columns for installation, concept or work, total cost, fiscal year to 20XX, monthly breakdown from January to December, scheduled 20XX and scheduled to be exercised 20XX. The second format is a technical evaluation table that considers variables such as annual average in MMPCD, annual volume in MMPC, gas value in MMPesos, operating expense and compression service distributed by year from 1 to n. The third format is a technical table for recording formation and gas-oil ratio expressed as RGA in cubic meters per cubic meter, differentiating between current and maximum values. These forms are part of the regulatory framework of the National Hydrocarbons Commission and CONAMER, including contact information at Avenida Patriotismo 580, colonia Nonoalco, Mexico City. Researchers and officials use these forms for the management of procedures, investment reports, evaluation of hydrocarbon projects and compliance with regulatory obligations before the authority.


**gemini-2.5-flash-lite** (2.8s):

This image contains three tables from the National Hydrocarbons Commission (CNH) published in the Official Journal of the Federation (DOF). The first table, titled "Part 16 of 18 Activity and Investment", details the total cost, fiscal year to 20XX and investment amount by month and scheduled for the installation and concept/work. The second table, "Part 17 of 18 Evaluation", presents the annual average (MMPCD), annual volume (MMPC), gas value (income in MMPesos), operating expense (MMPesos) and compression service (MMPesos) for years 1 to 18 and "n". The third table, "Part 18 of 18 Maximum RGA", focuses on the formation, with columns for "Current" and "Maximum" RGA (m³/m³). These tables are relevant for investment analysis, production evaluation and hydrocarbon metrics in Mexico.


**gpt-5.4-nano** (3.6s):

The image corresponds to an administrative format from gob.mx for the National Hydrocarbons Commission, with sections titled Part 16 of 18 Activity and Investment, Part 17 of 18 Evaluation, and Part 18 of 18 Maximum RGA. In Part 16 a table of Installation is shown with Concept/Stage, Total Capacity (Millions of Cubic Feet of Gas per Day or Millions of pesos), Fiscal Years 2020 and months January to December, and an Investment Amount column (Millions of Pesos) with fields Scheduled 2020 (Millions of pesos), Scheduled June and Scheduled December (Millions of pesos). In Part 17 the Evaluation is presented with a table of Annual Average (MMPCD) and its components Annual Vol. (MMPCD), Annual Vol. (MMPesos), Operating Expense (MMPesos) and Compression Service (MMPesos) for years 1 to 17, including a Total column. In Part 18 the Formation is established with RGA (m3/m3) for Current and Maximum, and includes mentions of the Government of Mexico, CONAMER and CNH, with reference to CNH institutional contact. This format is related to the Agreement dated December 12, 2019 and is framed within the regulatory planning and evaluation of the National Hydrocarbons Commission (CNH).


**grok-4.1-fast** (17.8s):

Set of tables from the PAGNA Format of the National Hydrocarbons Commission corresponding to Parts 16 of 18 Activity and Investment, 17 of 18 Evaluation and 18 of 18 Maximum RGA, with headers such as Installation Concept DOB Effective as of Dec. 31, months from January to December, Prog 2020 and Millions of Pesos for total investments reported in zeros. Includes table of Gas Value MMPCD and Operating Expenses MMPEsos for years 1 to 18 with totals in zeros, as well as a Formation table with Current and Maximum RGA columns in m³/m² without specific values. It displays logos of the Government of Mexico, CONAMER and CNH, along with contact data such as Av. Paseo de las Palmas 925 Col. Lomas de Chapultepec and references to Benito Juárez 562 Col. Roma Norte. These elements detail financial and technical projections for hydrocarbon evaluations, including scheduled investments 2020, operating expenses and maximum gas ratios by formation. Key terms for queries include CNH activity and investment, hydrocarbon economic evaluation, maximum RGA m³/m² and PAGNA Format parts 16 to 18.


**gemma-4-31b-it** (8.8s):

This image contains three administrative formats of the National Hydrocarbons Commission related to project management. The first format is an Activity and Investment table that details total costs, monthly investment amounts in millions of pesos and scheduling for the year 20XX. The second format is an Evaluation table with annual columns numbered 1 to 18 that records the annual average MMPCD, annual volume MMPC, gas value, operating expense and compression service. The third format is a Maximum RGA table that specifies the formation, current value and maximum value of the gas recovery rate in m3/m3. These documents include the logos of the Government of Mexico, CONAMER and CNH, being technical tools for hydrocarbon analysis and financial planning.


**claude-3-haiku** (4.7s):

The image shows a table containing information on Activity and Investment (Part 16 of 18) and Evaluation (Part 17 of 18) of the National Hydrocarbons Commission. It includes data such as Installation, Concept/Work, Total Cost, Fiscal Year Expense, Physical Progress, Investment Amount, 2020 Annual Scheduling, among others. A section on Maximum RGA (Part 18 of 18) is also presented with fields for Formation, Current and Maximum. This type of information would be relevant for lawyers, officials or researchers working with topics related to the hydrocarbon industry in Mexico, particularly with the Official Journal of the Federation and the activities of the National Hydrocarbons Commission.


</details>

---

### img08.png — Official document with header (INE)

![Official document with header (INE)](/images/posts/model-comparison/img08.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** prompt v2 (see above).

**Document context:**

> ción**
>
> **Derogado**
>
> #### TRANSITORIOS
>
> **Primero**. El presente Acuerdo entrará en vigor al día hábil siguiente de su publicación en el Diario Oficial de la Federación.
>
> **Segundo.** Los trámites iniciados ante la Comisión con anterioridad a la entrada en vigor del presente Acuerdo se substanciarían conforme a las disposiciones vigentes al inicio del trámite respectivo.
>
> Ciudad de México, a 12 de diciembre de 2019.- Comisionados Integrantes del Órgano de Gobierno de la Comisión Nacional de Hidrocarburos.- El Comisionado Presidente, **Rogelio Hernández Cázares**.- Rúbrica.- Los Comisionados:

</details>

<details>
<summary><strong>Responses from each model</strong></summary>

**gemini-3.1-flash-lite** (2.9s):

This image corresponds to the cover of an official administrative document issued by the National Electoral Institute identified as Security Plan for the Operation Model of the polling place with Electronic Ballot Box. The document establishes the technical and operational guidelines for the 2019-2020 Local Electoral Processes held in the federative entities of Coahuila and Hidalgo. The publication is dated February 2020 and constitutes a fundamental regulatory instrument for the implementation of electronic voting technologies in the Mexican electoral system. Researchers and officials can use this resource to consult the protocols of integrity, safeguarding and security applied to the electronic ballot boxes during said local elections. The file integrates the electoral operation standards defined by the INE to guarantee transparency and certainty on election day.


**gemini-2.5-flash-lite** (2.2s):

This document is a security plan from the National Electoral Institute (INE) for the operation model of the polling place with electronic ballot box in the local electoral processes of Coahuila and Hidalgo for 2019-2020. The publication date is February 2020. The document relates to electoral regulation and the implementation of technology in elections. Relevant search terms include "INE", "Local Electoral Processes", "Electronic Ballot Box", "Coahuila", "Hidalgo", "Security Plan" and "February 2020".


**gpt-5.4-nano** (5.6s):

The image shows an institutional cover/document format of the National Electoral Institute, corresponding to a Security Plan for the Operation Model of the polling place with Electronic Ballot Box for the 2019-2020 Local Electoral Processes in Coahuila and Hidalgo. The document explicitly identifies the agency as INE (National Electoral Institute) and includes the name of the plan and the territorial and local electoral process scope. It also shows the date of issue or version February 2020, relevant for locating the instrument within the electoral documentation. No article numbers, fractions or other normative references such as DOF or specific regulations are observed in the image, but the content functions as a reference for the operational security strategy for polling places with electronic ballot boxes in certain federative entities.


**grok-4.1-fast** (19.2s):

Official cover administrative format of the National Electoral Institute (INE) presenting the Security Plan for the operation of the polling place with electronic ballot box in the model of Local Electoral Processes 2019-2020 in Coahuila, dated February 2020. It includes the INE logo and its full name as National Electoral Institute. It is inferred to appear in a repealed Agreement of the National Hydrocarbons Commission published in the Official Journal of the Federation, with date of issue December 12, 2019 in Mexico City. It details transitory provisions such as entry into force on the business day following publication in the DOF and the processing of prior proceedings in accordance with provisions in force. Names of commissioners involved: Rogelio Hernández Cázares as President Commissioner, Alma América Porres Luna, Sergio Henrivier Pimentel Vargas and Néstor Martínez Romero. Key search terms include electronic ballot box security plan Coahuila, INE local elections 2019-2020, repealed CNH Agreement DOF December 2019.


**gemma-4-31b-it** (9.2s):

This image is a logo and cover of an administrative document belonging to the National Electoral Institute INE. The literal content indicates that it is the Security Plan for the Operation Model of the polling place with Electronic Ballot Box for the 2019-2020 Local Electoral Processes in Coahuila and Hidalgo. The document has February 2020 as its date of issue. A researcher or official would search for this content using terms such as electoral security, electronic ballot boxes, local electoral processes and polling place operability. This piece constitutes the official identification of a security protocol for the use of voting technology in specific states of Mexico.


**claude-3-haiku** (3.0s):

This image corresponds to a security plan for the operation model of the polling place with electronic ballot box for the 2019-2020 Local Electoral Processes in Coahuila and Hidalgo, published by the National Electoral Institute (INE) in February 2020. The document contains information on the guidelines and procedures to follow to guarantee the security and the adequate functioning of polling places with electronic ballot boxes in said states. Key terms that a lawyer, official or researcher could use to search for this content include: security plan, operation model, polling place with electronic ballot box, local electoral processes, Coahuila, Hidalgo, INE.


</details>

---

### img11.png — Screenshot of electoral accounting system (journal vouchers)

![Screenshot of electoral accounting system (journal vouchers)](/images/posts/model-comparison/img11.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** prompt v2 (see above).

**Document context:**

> la alta dirección capacitados de la Entidad Federativa sobre el nuevo Sistema de Justicia Laboral previo al 1° de octubre de 2020.
>
> > **2. Indicadores:** Los indicadores son útiles para poder medir con claridad los resultados obtenidos con la aplicación de programas, procesos o acciones específicos, con el fin de obtener el diagnóstico de una situación, comparar las características de una población o para evaluar las variaciones de un evento.
>
> > Permite identificar las diferencias existentes entre los resultados planeados y obtenidos como base para la toma de decisiones, fijar el rumbo y aline

</details>

<details>
<summary><strong>Responses from each model</strong></summary>

**gemini-3.1-flash-lite** (3.6s):

This image presents an administrative format for consulting accounting journal vouchers and screenshots of social networks and websites used as evidence in an electoral investigation. The journal voucher table details financial records of the obligated subject Local Municipal President Chihuahua Chihuahua, including columns such as journal voucher number, period of operation, type of journal voucher, date of operation, description and debit and credit amounts. The screenshots correspond to the Facebook page Fernando Tiscareño ftisca and the official website of Fernando Tiscareño, linking these digital assets with the civil association Chihuahua Participa A.C. The content is relevant for resource oversight processes, electoral transparency and accountability on campaign expenses. Key search terms include expense oversight, governmental accounting, digital evidence, reserved rights and political campaign financing in the municipality of Chihuahua.


**gemini-2.5-flash-lite** (3.4s):

This image contains a journal voucher table with detailed information on records, dates of operation and amounts, as well as screenshots of web pages and social network profiles. The legal identifiers inferred from the context are related to the "Federative Entity" and the possible application of "programs, processes or specific actions". Relevant search terms include "journal voucher table", "records", "dates of operation", "amounts", "web pages", "social networks", "Chihuahua Participa, A.C.", and "Fernando Tiscareño".


**gpt-5.4-nano** (3.9s):

The image is a screenshot and verification pages in administrative web interface format showing the query system of a journal voucher list, with columns such as Id, Authority Route, Correction Type, Income, Total Vouchers, and record references such as "OFICIO" and process statuses, as well as controls for query/modification and pagination. In the screenshot the documentary evidence text is appreciated where it is indicated that the pages www.fuerzatrabajo.com and "Fernando Tiscareño @ftisca" on Facebook were used to raise reasons and certificates, through which it is known that the reserved rights of both pages are in favor of "Chihuahua Pertica, A.C.", including the literal mention of the name "Fernando Tiscareño" and the user key "@ftisca". Screenshots of profiles or pages are also shown with the header "Fernando Tiscareño" and communication and publication elements related to "2019 ¡Es Esperanza!", as well as a cover or institutional page with the name "FERNANDO TISCAREÑO", all presented as support in a context of indicators and planned/obtained results for decision-making. Together, the image functions as operational proof or diagnostic support to substantiate ownership or reserved rights in a program or action procedure, without citing a specific article, NOM or date, but aligned with the period prior to October 1, 2020 mentioned in the document context.


**grok-4.1-fast** (20.6s):

Composite image of an electoral journal voucher table and screenshots of web pages related to political campaigns in Chihuahua. The table details voucher filters for the Centro Zone of the Local Board of Conciliation and Arbitration, with periods such as 07-01-2018 to 07-15-2018 17:49, types Normal, Correction and Income, totals in pesos such as 24,956.30 MXN, 29,869.70 MXN, 147,951.16 MXN and 131,386 MXN for records such as REGISTRO COM., PROPIETARIO D.G. and REGISTRO INGRE. It includes descriptions of the pages www.fuerzaytrabajo.com and Facebook profile of Fernando Tiscareño @fisca, raising reasons and certificates of embassies for Chihuahua Participe A.C. The screenshots show posts of events such as 2019 Esperanza, social programs and slogan "Recovering the privilege of governing with the people, two hundred the people and for the people". Key terms include electoral journal vouchers, Chihuahua elections, Local Board of Conciliation and Arbitration, Fernando Tiscareño and Fuerza y Trabajo campaigns.


**gemma-4-31b-it** (9.9s):

This image is a set of screenshots that function as documentary evidence in an administrative format. The content shows Facebook social network profiles belonging to fuerzatrabajo.com and Fernando Tiscareño @ftisca, as well as an institutional web page. It is explicitly mentioned that the reserved rights of both pages are in favor of Chihuahua Participa, A.C. Key terms include the transfer of digital property rights, social network evidence and the entity Chihuahua Participa, A.C. for legal or administrative verification purposes.


**claude-3-haiku** (4.7s):

The image shows a table with information on insurance policies, including data such as policy number, type of coverage, start and end dates, insured amount and premium. Some of the legal identifiers present are the policy registration number, the date of issue and the name of the insurance company. This information would be relevant for a lawyer, official or researcher who needs to consult the details of the insurance policies contracted by an entity. Key terms to search for this content would be "insurance policies", "policy record", "insurance coverage" and the name of the insurance company.


</details>

---
### img12.png — Mathematical Formula (Statistical Indicator)

![Mathematical formula (statistical indicator)](/images/posts/model-comparison/img12.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** the v2 prompt (see above).

**Document context:**

> rogramas, procesos o acciones específicas, con el fin de obtener el diagnóstico de una situación, comparar las características de una población o para evaluar las variaciones en un evento.
>
> Los indicadores permiten identificar las diferencias existentes entre los resultados planeados y obtenidos como base para la toma de decisiones, fijar el rumbo y alinear los esfuerzos hacia la consecución de las metas establecidas con el fin de lograr mejoras en los Programas.
>
> **Los indicadores que deberán medirse son los siguientes:**
>
> **a. Impacto de los spots en radio y televisión,** medido a través de

</details>

<details>
<summary><strong>Responses from each model</strong></summary>

**gemini-3.1-flash-lite** (2.3s):

Esta imagen presenta una fórmula matemática utilizada como indicador de gestión o evaluación de programas públicos. La expresión algebraica calcula un porcentaje mediante la división del número de ejemplares impresos entre el número de trabajadores registrados en el Estado, multiplicando el resultado por cien. Este indicador es fundamental para medir el alcance, la cobertura o la distribución de materiales informativos en relación con la población laboral activa. Los términos clave para la búsqueda semántica incluyen indicadores de desempeño, métricas de impacto, evaluación de programas, eficiencia administrativa y distribución de ejemplares. La fórmula permite a los funcionarios públicos cuantificar la penetración de materiales impresos dentro de un sector específico de la fuerza laboral estatal para la toma de decisiones y el seguimiento de metas institucionales.


**gemini-2.5-flash-lite** (1.6s):

Esta imagen presenta una fórmula matemática que representa un indicador. La fórmula se define como el "Número de ejemplares impresos" dividido por el "Número de trabajadores registrados en el Estado", multiplicado por 100. Este tipo de cálculo se utiliza comúnmente en análisis estadísticos y de gestión para medir la proporción o el alcance de ciertos materiales impresos en relación con la fuerza laboral de una entidad. Los términos clave para la búsqueda incluyen "indicador", "fórmula", "ejemplares impresos", "trabajadores registrados" y "Estado".


**gpt-5.4-nano** (1.9s):

La imagen corresponde a un formato tipo tabla o renglón de criterios de medición de indicadores, en el que se presenta una variable con la redacción Número de empleares impresos y su equivalente en unidades del Estado. Aparece el texto Número de trabajadores registrados en el Estado x 100, lo que indica una fórmula o cálculo para determinar un porcentaje relativo al número de trabajadores registrados. El documento, en el contexto de la medición de indicadores para Programas, usa este indicador para comparar resultados planeados y obtenidos y apoyar la toma de decisiones. No se observan identificadores legales explícitos como número de artículo, fracción, NOM, decreto o dependencia, pero el término Programas y la lógica de medición de impacto forman parte del contenido normativo del apartado de indicadores.


**grok-4.1-fast** (21.4s):

Esta imagen representa una fórmula matemática para el cálculo de un indicador cuantitativo en el contexto de programas y procesos evaluados mediante indicadores de impacto. La ecuación establece el cociente entre el número de ejemplares impresos multiplicado por 100 y el número de trabajadores registrados en el Estado, expresada como \frac{Número de ejemplares impresos \times 100}{Número de trabajadores registrados en el Estado}. Este indicador se relaciona con la medición de resultados en acciones específicas, como la comparación de poblaciones o variaciones en eventos para la toma de decisiones en programas públicos. Abogados y funcionarios podrían buscarlo mediante términos como fórmula de cobertura impresa, indicador de impacto por trabajador registrado, ejemplares impresos por estado o ratio de difusión laboral en el Diario Oficial de la Federación. Se alinea con la evaluación de diferencias entre resultados planeados y obtenidos en metas establecidas.


**gemma-4-31b-it** (9.1s):

Esta imagen es una fórmula matemática que representa un indicador de medición administrativa. El contenido literal de la operación consiste en la división del Número de ejemplares impresos entre el Número de trabajadores registrados en el Estado, multiplicando el resultado por 100. Este cálculo se utiliza para determinar la cobertura o distribución de materiales impresos en relación con la población laboral de una entidad. Un investigador o funcionario buscaría este contenido mediante términos como indicador de desempeño, medición de impacto, cobertura de ejemplares impresos o fórmula de cálculo de distribución. El elemento sirve como herramienta de evaluación para el diagnóstico de situaciones y la toma de decisiones dentro de los programas gubernamentales mencionados en el texto.


**claude-3-haiku** (3.7s):

La imagen muestra una tabla con dos indicadores relacionados con la difusión de spots publicitarios en radio y televisión. El primer indicador es el "Número de ejemplares impresos", que no tiene un valor numérico asociado. El segundo indicador es el "Número de trabajadores registrados en el Estado", cuyo valor se presenta como un porcentaje. Este tipo de información sería relevante para un abogado, funcionario o investigador que esté analizando los procesos de comunicación y difusión de programas o acciones gubernamentales, así como los datos sobre la fuerza laboral registrada en el estado. Los términos clave para buscar este contenido serían: indicadores, spots publicitarios, radio, televisión, trabajadores registrados, datos estadísticos.


</details>

---

### img13.png — Mathematical Notation (Technical Variable)

![Mathematical notation (technical variable)](/images/posts/model-comparison/img13.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** the v2 prompt (see above).

**Document context:**

> s instituciones de crédito presentarán sus posturas sin conocer las demás posturas presentadas o cualquier información relacionada. En este caso, la institución postora recibirá la información de las demás posturas hasta que el Banco de México dé a conocer a todas las instituciones de crédito postoras los resultados de la Subasta de Crédito en Dólares conforme a lo dispuesto en el numeral 8, o
>
> > b) Interactivas: aquellas en que las instituciones de crédito que presenten sus posturas puedan conocer la tasa marginal de asignación de la Subasta de Crédito en Dólares a partir del momento en que e

</details>

<details>
<summary><strong>Responses from each model</strong></summary>

**gemini-3.1-flash-lite** (2.4s):

Esta imagen consiste en una expresión matemática que representa el subíndice j y el superíndice min, los cuales son elementos técnicos utilizados en la formalización de modelos de subasta. El contenido literal corresponde a la notación matemática j min, empleada para definir variables de optimización o límites en los procesos de asignación de crédito. Este fragmento es fundamental para la interpretación de las reglas de operación de las subastas de crédito en dólares realizadas por el Banco de México. Los investigadores y funcionarios que analizan la normativa financiera buscarán este término para comprender la metodología de cálculo de tasas marginales y criterios de adjudicación. La expresión forma parte de la estructura algorítmica que rige la transparencia y competitividad en las subastas interactivas de instituciones de crédito.


**gemini-2.5-flash-lite** (1.4s):

Esta imagen representa una notación matemática utilizada en el contexto de subastas de crédito en dólares, específicamente en el Diario Oficial de la Federación. La notación incluye subíndices y superíndices que denotan variables y sus derivadas, como $\dot{j}_j$ y $\dot{m}\dot{n}$. Estos elementos son cruciales para la formulación de modelos económicos y financieros que describen el comportamiento de las instituciones de crédito en procesos de licitación y asignación de recursos. La comprensión de esta notación es fundamental para analistas financieros, reguladores y académicos que estudian la política monetaria y los mercados financieros en México.


**gpt-5.4-nano** (3.5s):

La imagen corresponde a un fragmento de texto de un documento legal del DOF sobre Subasta de Crédito en Dólares, específicamente una clasificación de tipos de subastas en el apartado donde se comparan posturas presentadas por instituciones de crédito y el momento en que puede conocerse información de otras posturas. En el contexto se describen las subastas no interactivas o aquellas en que las instituciones de crédito presentarán sus posturas sin conocer las demás posturas ni información relacionada, y se establece que la institución postora recibirá la información de las demás posturas hasta que el Banco de México dé a conocer a todas las instituciones de crédito postoras los resultados conforme a lo dispuesto en el numeral 8. También se menciona el inciso b) denominado Interactivas, indicando que en estas las instituciones de crédito pueden conocer la tasa marginal de asignación de la Subasta de Crédito en Dólares a partir del momento en que el monto total de las posturas presentadas por todas las instituciones de crédito postoras sea igual; adicionalmente aparece el símbolo i con superíndice n asociado al texto, relevante para identificar variables o notación utilizada en el procedimiento. Esta descripción es útil para búsquedas de abogados y funcionarios sobre reglas de subastas, confidencialidad de posturas, información disponible durante la subasta y referencia expresa al numeral 8 y al Banco de México en materia de subasta de crédito en dólares.


**grok-4.1-fast** (12.4s):

Esquema o formato administrativo que ilustra las modalidades de Subasta de Crédito en Dólares del Banco de México, diferenciando entre subastas no interactivas (a) e interactivas (b). En las no interactivas, las instituciones de crédito presentan posturas sin conocer las demás ni información relacionada, recibiendo detalles solo hasta que el Banco de México publique resultados conforme al numeral 8. En las interactivas, las postoras conocen la tasa marginal de asignación desde que el monto total de posturas iguala el objetivo. Incluye términos clave como posturas, tasa marginal de asignación, instituciones de crédito postoras y monto total de posturas. Este contenido es relevante para regulaciones sobre subastas crediticias en dólares, operaciones del Banco de México y mecanismos de licitación financiera en documentos del Diario Oficial de la Federación.


**gemma-4-31b-it** (8.9s):

Esta imagen es una representación de una fórmula matemática o notación algebraica compuesta por caracteres técnicos. El contenido literal muestra los símbolos i, j y m con subíndices y superíndices, específicamente la letra m con un punto superior y los índices i y j. Debido al contexto del documento, este elemento se relaciona con los procedimientos de las Subastas de Crédito en Dólares coordinadas por el Banco de México. Un investigador o funcionario buscaría este contenido mediante términos como modelado matemático de subastas, tasa marginal de asignación o fórmulas de cálculo de posturas bancarias. La imagen sirve como soporte técnico para la descripción de las modalidades de subastas interactivas y no interactivas.


**claude-3-haiku** (2.4s):

La imagen muestra una tabla o formato administrativo que contiene información relacionada con una Subasta de Crédito en Dólares. Incluye identificadores legales como "numeral 8" y menciona "instituciones de crédito" y "posturas" en el contexto de dicha subasta. La tabla presenta dos tipos de posturas: "a) Ciegas" y "b) Interactivas", con descripciones detalladas de cada una. Este tipo de contenido sería relevante para abogados, funcionarios o investigadores interesados en regulaciones y procedimientos bancarios relacionados con subastas de crédito en dólares en México.


</details>

---

### img19.png — Empty Table (Form Fields)

![Empty table (form fields)](/images/posts/model-comparison/img19.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** the v2 prompt (see above).

**Document context:**

> |
> +-------------------------------------------------------------------------------------------------------------------+----------------------------------------------------------------------+
> | Nombre o Razón Social:                                                                                            | RFC                                                                  |
> |                                                                                                                   |                                                                      |
> |

</details>

<details>
<summary><strong>Responses from each model</strong></summary>

**gemini-3.1-flash-lite** (1.7s):

Esta imagen consiste en un formato administrativo de captura de datos compuesto por una serie de doce casillas rectangulares alineadas horizontalmente. El elemento se encuentra integrado en un formulario oficial diseñado para el registro del Registro Federal de Contribuyentes, comúnmente abreviado como RFC, dentro de documentos legales o administrativos. La estructura de las celdas permite la inserción individual de caracteres alfanuméricos necesarios para la validación de la clave de identificación fiscal ante las autoridades tributarias mexicanas. Este tipo de campos de llenado es utilizado frecuentemente en solicitudes, declaraciones y trámites oficiales publicados en el Diario Oficial de la Federación para asegurar la estandarización de la información. La disposición de los espacios facilita la captura precisa de la homoclave y los datos de identidad del contribuyente, ya sea persona física o moral.


**gemini-2.5-flash-lite** (1.5s):

Esta imagen es un formato administrativo que contiene campos para registrar información legal. Incluye espacios para el "Nombre o Razón Social" y el "RFC", identificadores clave en trámites y registros mercantiles en México. La estructura sugiere la recopilación de datos de personas físicas o morales, esencial para la identificación fiscal y legal. Este tipo de formato es común en documentos del Diario Oficial de la Federación (DOF) relacionados con registros de empresas, trámites fiscales o normativas que requieran la identificación precisa de los contribuyentes. La presencia de estos campos es fundamental para la correcta aplicación de leyes y regulaciones.


**gpt-5.4-nano** (3.1s):

La imagen corresponde a un formato administrativo tipo tabla o formulario del Diario Oficial de la Federación con campos para el registro de datos fiscales, en el que se observa una sección de Nombre o Razón Social y un campo de RFC. El formato presenta renglones o casillas alineadas para capturar el Nombre o Razón Social, seguido de columnas reservadas para el Registro Federal de Contribuyentes (RFC). En el contexto proporcionado, se infiere que el documento busca integrar información del contribuyente, indicando explícitamente las claves de identificación Nombre o Razón Social y RFC, con espacios en blanco para completar. Esta clase de formato es utilizable para búsquedas de obligaciones de identificación de contribuyentes en trámites gubernamentales y compilaciones normativas publicadas en el DOF.


**grok-4.1-fast** (12.4s):

Es un formato administrativo en tabla con dos columnas principales destinadas a la identificación fiscal de personas morales o físicas. La columna izquierda presenta el campo "Nombre o Razón Social" con espacios en blanco para su llenado, mientras que la derecha está etiquetada como "RFC" para el Registro Federal de Contribuyentes. Este formulario estandarizado se utiliza en trámites fiscales y registros oficiales del Diario Oficial de la Federación. Incluye líneas divisorias para separar los campos de entrada de datos como nombres propios, claves alfanuméricas de RFC y datos empresariales. Abogados y funcionarios buscan términos como formulario RFC, razón social, registro contribuyente, identificación fiscal mexicana o formato DOF para contribuyentes.


**gemma-4-31b-it** (9.7s):

Esta imagen es un formato administrativo consistente en una serie de recuadros alineados horizontalmente. El diseño está destinado al llenado de datos alfanuméricos, específicamente para el Registro Federal de Contribuyentes RFC, según se infiere del contexto del documento. Los espacios segmentados permiten la captura individual de caracteres para asegurar la legibilidad de la clave fiscal. Este elemento es fundamental para la identificación tributaria de una persona física o moral en trámites oficiales. Un abogado o investigador buscaría este contenido mediante términos como formato de RFC, casilla de registro fiscal o formulario de identificación tributaria.


**claude-3-haiku** (3.1s):

La imagen muestra un formato administrativo con espacios en blanco para que el usuario ingrese información. Específicamente, se trata de un campo para ingresar el "Nombre o Razón Social" y otro campo para ingresar el "RFC" (Registro Federal de Contribuyentes). Este tipo de formato es comúnmente utilizado en documentos legales y administrativos mexicanos, como declaraciones fiscales o trámites gubernamentales. Un abogado, funcionario o investigador que busque este tipo de información podría utilizar términos como "formato administrativo", "datos de identificación", "nombre legal" y "RFC" para encontrar este contenido.


</details>

---
### img20.png — Geographic map of closed fishing zone (Sinaloa)

![Geographic map of closed fishing zone (Sinaloa)](/images/posts/model-comparison/img20.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** prompt v2 (see above).

**Document context:**

> Ley General de Mejora Regulatoria y Quinto del "Acuerdo que fija los lineamientos que deberán ser observados por las dependencias y organismos descentralizados de la Administración Pública Federal, en cuanto a la emisión de los actos administrativos de carácter general a los que les resulta aplicable el artículo 69-H de la Ley Federal de Procedimiento Administrativo", publicado en el Diario Oficial de la Federación, el 8 de marzo de 2017, realizará las acciones de simplificación sobre el trámite indicado en el anexo correspondiente del AIR, en un plazo de seis meses contados a partir de la ent

</details>

<details>
<summary><strong>Responses from each model</strong></summary>

**gemini-3.1-flash-lite** (2.0s):

This geographic map details the delimitation of the permanent closed fishing zone for harvesting chocolate clam *Megapitaria squalida* in the Altata-Ensenada del Pabellón Lagoon System located in the state of Sinaloa. The cartographic representation includes the municipalities of Navolato and Culiacán, marking reference points identified with the letters A, B, C, D, E, F, G, H, I, J, and K along the Gulf of California coastline. The area shaded with diagonal lines specifically defines the polygonal area subject to fishing restrictions under current environmental regulation. This visual resource is essential for researchers, fishing authorities, and public officials who need to verify the exact geographic limits of marine resource protection zones in the Official Journal of the Federation (DOF). The image provides precise geographic coordinates and a 10-kilometer reference scale for the correct interpretation of administrative conservation measures.


**gemini-2.5-flash-lite** (2.7s):

This is a map showing the "Permanent Closed Fishing Zone" for the "Chocolate Clam (*Megapitaria squalida*)" in the Altata-Ensenada del Pabellón Lagoon System, Sinaloa. The map details the geographic location with latitude and longitude coordinates, and identifies key points such as Navolato and Culiacán. The permanent closed fishing zone is represented with a diagonal stripe pattern and is located in the Gulf of California. The map includes a graphic scale in kilometers and indicates the presence of the species in question. This type of information is relevant for fisheries management and the conservation of marine resources in Mexico.


**gpt-5.4-nano** (3.1s):

This is a geographic map with zone markers and reference to a lagoon system. The map identifies the Baja California peninsula and areas such as the Gulf of California and Sinaloa, as well as the Altata-Ensenada del Pabellón Lagoon System, with localities or points labeled A, B, C, D, E, F, G, H, I, J, K, and L, and a Permanent Closed Fishing Zone for the Management Zone (*Megaprimaria acuadalula*) (more) indicating that it corresponds to a permanent closed area. Coordinate ranges in approximate latitudes of 24.6°N, 24.5°N, and 24.4°N are also shown, a graphic scale of 0 to 10 km, and longitudes of 107.9°W, 107.8°W, 107.7°W, and 107.6°W, with a north-pointing arrow. Based on the provided context (DOF and guidelines linked to general administrative acts), this image can be searched as part of the corresponding annex of the RIA of the Agreement published in the DOF on March 8, 2017, and includes zoning/closure elements for administrative and regulatory purposes related to the lagoon system and its management.


**grok-4.1-fast** (23.7s):

Geographic map of the Altos-Ensenada del Pabellón lagoon system in the Gulf of California, covering Sinaloa coasts with references to Culiacán and boundaries toward Sonora. It represents the permanent closed fishing zone for Chocolate Clam (*Megapanopeus* sp.), shaded with striped patterns in areas such as Clam Navolato, Navolato Zone, and lagoon extensions. It identifies key coordinate points A to K, with coastlines, lagoons, and a scale of 0 to 10 km. It includes parallels 24.6°N, 24.5°N, and 24.4°N, as well as meridians 107°W to approximately 106.5°W. This diagram details regulated zones for fishing activities in Sinaloa, useful for queries on permanent closures, Pacific lagoon systems, and biological restrictions on Mexican coasts.


**gemma-4-31b-it** (17.9s):

This image is a geographic map that delimits the permanent closed fishing zone for the Chocolate Clam *Megapitaria squalida*. The shaded area is located in the state of Sinaloa, specifically in the Altenta-Ensenada del Pabellón Lagoon System, covering regions near Navolato and Culiacán facing the Gulf of California. The map includes geographic coordinates between 24.4°N and 24.6°N and between 107.5°W and 107.9°W, in addition to reference points marked with letters A through K. A researcher or official would search for this content using terms such as fishing closure, marine species protection, geographic delimitation of closure in Sinaloa, and conservation of *Megapitaria squalida*.


**claude-3-haiku** (3.2s):

The image shows a geographic map representing the Alacrán-Ensenada del Pabellón Lagoon System, located in the Gulf of California, in the states of Sinaloa and Nayarito. The map includes the delimitation of the permanent closed fishing zone (Critical Area) and other relevant geographic areas such as Navolato and Culiacán. This map would be useful for officials, lawyers, and academics working on issues related to the regulation and administration of natural resources, protected areas, and coastal zones in Mexico, particularly in the Gulf of California.


</details>

---

### img21.png — Organizational chart of the Auditoría Superior de la Federación (ASF)

![Organizational chart of the Auditoría Superior de la Federación](/images/posts/model-comparison/img21.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** prompt v2 (see above).

**Document context:**

> **FUNCIONES GENERALES**
>
> Auditorías Especiales
>
> Unidades
>
> Direcciones Generales
>
> Direcciones de Área
>
> Subdirecciones de Área
>
> Jefaturas de Departamento
>
> Coordinadores/as de Auditores/as y Auditores/as
>
> **IV. ORGANIGRAMAS, ATRIBUCIONES Y FUNCIONES**
>
> **ORGANIGRAMA DE LA AUDITORÍA SUPERIOR DE LA FEDERACIÓN**
>

</details>

<details>
<summary><strong>Responses from each model</strong></summary>

**gemini-3.1-flash-lite** (2.3s):

This diagram represents the structural organizational chart of the Auditoría Superior de la Federación, the technical oversight body of the Congress of the Union. The hierarchy is headed by the Auditor Superior de la Federación, who is directly supported by the areas of Advisor and the Secretariat of the Auditor Superior de la Federación. The operational structure is composed of the administrative units Special Audit of Financial Compliance, Special Audit of Performance, Special Audit of Federalized Spending, and Special Audit of Follow-up, Reports and Investigation. Likewise, the organizational chart includes the Technical Unit of the Auditoría Superior de la Federación, the Legal Affairs Unit, the General Administration Unit, the Regulatory and Legislative Liaison Unit, and the Gender Equality and Oversight Culture Unit. This scheme is essential for understanding the internal organization, attributions, and distribution of functions of the institution in accordance with its current regulatory framework.


**gemini-2.5-flash-lite** (2.0s):

This is an organizational chart of the Auditoría Superior de la Federación. It shows the institution's hierarchical structure, headed by the Auditor Superior de la Federación. Below him are the Secretariat of the Auditor Superior de la Federación and an Advisor, both represented with dashed lines, indicating an advisory or consultative relationship. The main structure breaks down into various units, including the Technical Unit of the Auditoría Superior de la Federación, Special Audit of Financial Compliance, Special Audit of Performance, Special Audit of Federalized Spending, Special Audit of Follow-up, Reports and Investigation, Legal Affairs Unit, General Administration Unit, Regulatory and Legislative Liaison Unit, and Gender Equality and Oversight Culture Unit. This type of diagram is essential for understanding the organization and responsibilities within the superior oversight of the Federation.


**gpt-5.4-nano** (2.8s):

The image is an organizational chart of the Auditoría Superior de la Federación that shows the organic and hierarchical structure of different units. At the top is the Auditor Superior de la Federación, with branches toward Advisor, and toward Secretariat of the Auditor Superior de la Federación, as well as a vertical configuration connecting with the level of units and directorates. At the lower level, the following are identified as units: Technical Unit of the Auditoría Superior de la Federación, Special Audit of Financial Compliance, Special Audit of Performance, Special Audit of Federalized Spending, Special Audit of Follow-up, Reports and Investigation, Legal Affairs Unit, General Administration Unit, Regulatory and Legislative Liaison Unit, and Gender Equality and Oversight Culture Unit. This content is useful for searches on general functions, organizational structure, attributions, and internal organizational charts of the ASF, and specifically on the areas of Special Audits and support units.


**grok-4.1-fast** (10.6s):

Hierarchical organizational chart of the Auditoría Superior de la Federación showing the organizational structure with the Auditor Superior de la Federación at the top, connected to an Advisor and the Secretariat of the Auditor Superior de la Federación. From the secretariat branch out the Technical Unit of the Auditoría Superior de la Federación and various Special Audits, including Special Audit of Financial Compliance, Special Audit of Performance, Special Audit of Federalized Spending, Special Audit of Follow-up, Special Audit of Reports and Investigations. At the base appear units such as Legal Affairs Unit, General Administration Unit, Legislative Liaison Unit, and Gender Equality and Oversight Culture Unit. This diagram is part of Section IV Organizational Charts, Attributions and Functions of the document on general functions of the ASF, with key terms such as special audits, general directorates, and administrative units for searches in federal oversight regulations.


**gemma-4-31b-it** (20.6s):

This diagram represents the organizational chart of the Auditoría Superior de la Federación. At the top is the Auditor Superior de la Federación, who has the support of an Advisor and the Secretariat of the Auditor Superior de la Federación. The scheme details the hierarchical structure of the dependent units, including the Technical Unit of the Auditoría Superior de la Federación, the Legal Affairs Unit, the General Administration Unit, the Regulatory and Legislative Liaison Unit, and the Gender Equality and Oversight Culture Unit. Likewise, the Special Audits of Financial Compliance, Performance, Federalized Spending, and Follow-up, Reports and Investigation are specified. This content is essential for researchers or officials seeking the organic structure, attributions, and administrative hierarchy of superior oversight in Mexico.


**claude-3-haiku** (4.5s):

This image represents an organizational chart of the organizational structure of the Auditoría Superior de la Federación. It includes the following elements:

Auditor Superior de la Federación, who has under their command an Advisor and the Secretariat of the Auditor Superior de la Federación. Below the Auditor Superior are various specialized units and directorates, such as the Technical Unit of the Auditoría Superior de la Federación, Special Audits (of Financial Compliance, of Performance, of Federalized Spending), Special Audit of Follow-up, Reports and Investigation, Legal Affairs Unit, General Administration Unit, and Gender Equality and Oversight Culture Unit.

This organizational chart would be relevant for officials, lawyers, and auditors who need to understand the structure and attributions of the Auditoría Superior de la Federación, a key oversight body in the Mexican legal system.


</details>

---

### img22.png — Figure A.7 - Measurement of external static pressure (NOM-011-ENER-2024)

![Figure A.7 - Measurement of external static pressure (NOM-011-ENER-2024)](/images/posts/model-comparison/img22.png)

<details>
<summary><strong>Prompt used</strong></summary>

**System prompt:** prompt v2 (see above).

**Document context:**

> **Figura A.5 - Aparato de medición de flujo de aire**
>
> `![](media/image157.png)`
>
> **Figura A.6 - Tobera para la medición del flujo de aire**
>
> `![](media/image158.png)`
>
> **Figura A.7 - Medición de la presión estática externa**
>
> `![](media/image159.png)`
>
> **Figura A.8 - Medición de caída de presión estática del aire para una sección de serpentín sin ventiladores**

</details>

<details>
<summary><strong>Responses from each model</strong></summary>

**gemini-3.1-flash-lite** (2.7s):

This technical diagram illustrates the measurement of static pressure drop for a coil section without fans according to Figure A.8. The scheme details the configuration of the inlet and outlet ducts, including the location of pressure measurement devices and the connection to the air measurement apparatus. Space requirements are specified through the variables 1.5 A x B and 0.5 A x B for the outlet, as well as 0.5 C x D and 1.5 C x D for the inlet. The document defines that A and B correspond to the outlet dimensions, while C and D represent the inlet dimensions of the system. This graphic resource is essential for engineers and technical standard specialists who need to standardize evaluation procedures for efficiency and pressure drop in air conditioning and air handling equipment.


**gemini-2.5-flash-lite** (3.1s):

This is a diagram illustrating the air measurement apparatus, showing the outlet duct and the inlet duct, both equipped with pressure measurement devices. A coil section is detailed and relative dimensions such as 0.5 A x B and 1.5 A x B for the outlet, and 0.5 C x D and 1.5 C x D for the inlet are specified. Variables A and B represent the outlet dimensions, while C and D correspond to the inlet dimensions. This diagram is relevant for determining air flow and pressure drop in ventilation or air conditioning systems.


**gpt-5.4-nano** (3.9s):

The image corresponds to a technical schematic of the air flow measurement apparatus, identified in the document as Figure A.5 - Air flow measurement apparatus. The outlet duct and the inlet duct are shown, with Coil Section and Pressure Measurement Devices, as well as ducts and taps for measurement, including the representation of the outlet and the location of static pressure measurements, with dimension indications expressed as 1.5 A x B and 0.5 A x B for the area associated with the outlet, as well as 0.5 C x D and 1.5 C x D for the area associated with the inlet. The scheme also expressly notes dimension relationships: A and B = Outlet Dimensions and C and D = Inlet Dimensions. This content is useful for searches on regulations for air flow measurement, installation and sizing of ducts, location of pressure measurement devices, and calculation/definition of sections in coil tests.


**grok-4.1-fast** (11.1s):

Schematic diagram of Figure A.5 corresponding to the air flow measurement apparatus, illustrating the outlet duct with dimensions 1.5 A x B and pressure measurement devices of 0.5 A x B, connected to a central coil section. At the bottom, the inlet duct is shown with dimensions 1.5 C x D and pressure measurement devices of 0.5 C x D, with flow indicator arrows and tubular connections. Dimensions A and B are defined as outlet, while C and D correspond to inlet. This scheme details the configuration for measuring static pressure and pressure drop in coil sections without fans, useful in technical ventilation and air conditioning standards. Key terms include air flow measurement, external static pressure, tobillera, and coil.


**gemma-4-31b-it** (12.5s):

This image is a technical diagram identified as Figure A.5 Air Flow Measurement Apparatus. The scheme details the configuration of a system that includes an outlet duct, a coil section, and an inlet duct, integrating pressure measurement devices at specific points. Technical dimensions and ranges are specified through the formulas 1.5 A x B and 0.5 A x B for the outlet, as well as 1.5 C x D and 0.5 C x D for the inlet. The text explicitly defines that A and B represent the outlet dimensions, while C and D correspond to the inlet dimensions. This content is essential for specialists seeking technical specifications on air flow instrumentation, static pressure measurement, and coil installation standards in ventilation systems.


**claude-3-haiku** (3.9s):

This image shows a schematic diagram of an air flow measurement apparatus. It includes legal identifiers such as "Outlet Duct", "Pressure Measurement Devices", "Coil Section", and "Inlet Duct", which would be key terms for searching for this type of content related to air flow measurement in Mexican legal documents such as the DOF. Outlet and inlet dimensions are also included, as well as formulas for calculating air flow, which would be relevant information for engineers, technicians, or researchers interested in this type of measurement equipment used in standards or regulations.


</details>

---
## Observations by model

**gemini-3.1-flash-lite** (avg 2.8s): Remains the fastest, alongside gemini-2.5-flash-lite. Generates well-structured paragraphs. Tends to include more inferences from the context when the image is ambiguous. On img05 (the domestic market bar chart) it writes "relacionado con la regulación de calefactores de ambiente bajo la normativa técnica" — that is the context from another image in the same NOM, not this chart. It is mixing contexts. That is concerning: it suggests that when the context does not match the image, the model invents a plausible connection instead of recognizing the discrepancy.

**gemini-2.5-flash-lite** (avg 2.1s): The fastest of all. Consistent responses but sometimes shorter. Good speed/quality balance. On img05 it describes exactly what it sees without inventing a false regulatory connection. On img06 it extracts the form fields accurately.

**gpt-5.4-nano** (avg 3.7s): Good overall performance. Tends to be more literal with the image content. Well-formed paragraphs.

**grok-4.1-fast** (avg 15.7s): The slowest by a wide margin. Longer and more detailed responses. Sometimes includes information not present in the image or context.

**gemma-4-31b-it** (avg 11.4s): Surprisingly good, underrated. Sometimes excellent, sometimes repeats patterns. Second slowest.

**claude-3-haiku** (avg 3.7s): Improved with prompt v2, but still the weakest. In v1 it gave "dos formas geométricas: un círculo y una figura rectangular". In v2 it gives a coherent description of the tape measure. The improved prompt helped it more than the others because v1 confused it with the tag structure. But it remains by far the most expensive (~$45 for 98k) with quality inferior to Gemini 2.5 Flash Lite. It has no economic justification in this lineup.

## Main findings

1. **Prompt v2 produces better text for RAG.** By removing the tags, descriptions are more natural and flow better as indexable text. Models no longer mechanically repeat "TIPO: tabla, CONTENIDO LITERAL: ...".

2. **The instruction to use the caption works.** In images where the context included "FIGURA A.7" or table titles, the models incorporated it as a starting point.

3. **The rule "no menciones identificadores si no hay" cleans up the responses.** Before, models invented articles or laws that did not appear. Now they only mention them when present.

4. **Grok is slow but detailed.** Its responses are consistently the longest. For a pipeline processing ~98k images, time is an important factor.

5. **Gemma has variable quality.** Sometimes it produces excellent descriptions, sometimes it gets lost in irrelevant details.

6. **The fast group (Gemini Flash, GPT Nano, Claude Haiku)** remains the best cost/benefit balance. All three average between 2-4 seconds.

If I had to choose today for the production run: Gemini 2.5 Flash Lite, with Gemma 4 31B as cross-validation on a subset of high-importance images (regulatory tables, maps, organizational charts). Grok is out due to latency. Claude 3 Haiku is out due to cost-quality. Gemini 3.1 is tempting but the risk of connecting incorrect contexts is a real problem at the scale of 98k images.
## What's next?

- Test prompt v2 with a larger batch of images (50–100) to validate consistency
- Evaluate descriptions with retrieval metrics (not just perceived quality). But for this we still need examples...
- So it's worth starting to build the search DB
