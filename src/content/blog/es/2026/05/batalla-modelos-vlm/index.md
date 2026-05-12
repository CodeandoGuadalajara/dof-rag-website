---
title: "Batalla de modelos VLM: ¿Quién describe mejor las imágenes del DOF?"
date: 2026-05-12
author: Equipo DOF-RAG
description: >-
  Comparamos 6 modelos de visión (Gemini, GPT, Qwen, Claude) en la tarea de
  generar descripciones de imágenes para indexación RAG del Diario Oficial
  de la Federación.
image: /images/posts/model-comparison/img20.png
tags:
  - DOF-RAG
  - IA
  - visión
  - modelos
  - comparación
  - OpenRouter
featured: true
---

# Batalla de modelos VLM: ¿Quién describe mejor las imágenes del DOF?

La verdad es que cuando empezamos a evaluar modelos para generar descripciones de imágenes del Diario Oficial de la Federación, pensábamos que la respuesta sería obvia.Spoiler: no lo fue :-p

Nuestro pipeline de [enriquecimiento de imágenes](https://github.com/CodeandoGuadalajara/dof-rag/pull/53) necesita generar descripciones textuales optimizadas para **búsqueda semántica** — no descripciones visuales bonitas, sino texto que un abogado o funcionario público realmente buscaría. El reto es que las imágenes del DOF son muy diversas: logos institucionales, tablas densas, diagramas técnicos, mapas geográficos, formatos administrativos...

Así que decidimos hacer una comparación sistemática. Corrimos **6 modelos** de visión a través de **OpenRouter** sobre **15 imágenes** representativas del DOF y comparamos calidad, velocidad y capacidad de seguir instrucciones.

## Los contendientes

| Modelo | Proveedor | Costo estimado (98k imágenes) |
|--------|-----------|-------------------------------|
| gemini-3.1-flash-lite | Google | ~$1.87 |
| gemini-2.5-flash-lite | Google | ~$1.87 |
| gpt-5.4-nano | OpenAI | ~$2.34 |
| qwen3.6-flash | Qwen | ~$2.00 |
| qwen3.5-flash-02-23 | Qwen | ~$2.00 |
| claude-3-haiku | Anthropic | ~$9.44 |

Todos se probaron con el mismo prompt optimizado para indexación RAG en español, pidiendo: tipo de imagen, identificadores legales, contenido literal y vocabulario de búsqueda. Sin descripciones visuales.

## El prompt utilizado

Para todas las imágenes se utilizó el mismo **system prompt**:

> Eres un sistema de indexacion para un motor RAG (Retrieval Augmented Generation) sobre documentos legales mexicanos en espanol.
>
> Tu unica tarea es generar una descripcion de imagenes optimizada para busqueda semantica. La imagen original estara disponible en la fase de generacion de respuestas, por lo que NO debes describir aspectos visuales como colores, bordes o diseno grafico.
>
> Genera una descripcion que incluya obligatoriamente:
> 1. TIPO: Indica si es tabla, diagrama, grafica, mapa, organigrama, figura, fotografia, etc.
> 2. IDENTIFICADORES LEGALES: Numero de articulo, fraccion, inciso, nombre del reglamento, decreto, ley, norma oficial mexicana (NOM), DOF, fecha o cualquier referencia legal que aparezca en la imagen o se infiera del contexto del documento.
> 3. CONTENIDO LITERAL: Todos los valores numericos, rangos, categorias, claves, abreviaturas y terminos tecnicos exactamente como aparecen.
> 4. VOCABULARIO DE BUSQUEDA: Los terminos legales y tecnicos en espanol que un abogado, funcionario publico, notario o investigador usaria al buscar este contenido.
>
> NO incluyas descripciones visuales, frases introductorias, comillas, markdown, listas con guiones, o cualquier formato especial.
>
> Responde UNICAMENTE con la descripcion en texto corrido, en espanol, entre 4 y 8 oraciones.

Para cada imagen, el **user prompt** incluye el contexto extraído del documento markdown que rodea la imagen (800 caracteres antes y 200 después). Puedes expandir cada sección para ver el prompt exacto que se le envió al modelo.

## Los resultados — imagen por imagen

---

### Imagen 01 — Diagrama técnico de componentes mecánicos (cinta métrica)

![Diagrama técnico de componentes mecánicos (cinta métrica)](/images/posts/model-comparison/img01.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
> lece en 7.1.
> 
> **5.2** Exactitud de la cinta
> 
> Las líneas que indiquen las divisiones de la cinta deben ser como máximo de 0,40 mm de ancho, perpendiculares al eje longitudinal de la cinta, ser claras, exactas y resistentes al uso. La longitud de las líneas deben ser variables en razón directa del valor mayor que limitan las unidades con números de orden indicados con caracteres arábigos, por lo menos para los decímetros y unidades mayores. Las cintas tipo 1 deben subdividirse en milímetros en toda su extensión; las cintas tipo 2, deben subdividirse por lo menos en decímetros y el primer decímetro subdividido en milímetros, tanto las tolerancias de longitud como la carga a que debe sujetarse l
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (2.3s):

> TIPO diagrama técnico de componentes mecánicos para dispositivos de medición o seguridad. IDENTIFICADORES LEGALES este esquema se relaciona con las especificaciones técnicas de instrumentos de medición regulados por la Ley Federal sobre Metrología y Normalización y las Normas Oficiales Mexicanas NOM aplicables a cintas métricas y dispositivos de precisión. CONTENIDO LITERAL el diagrama muestra un mecanismo de enrollado circular con una cinta extendida y un soporte de sujeción con base cóncava para el anclaje de componentes. VOCABULARIO DE BUSQUEDA los términos técnicos incluyen metrología legal, instrumentos de medición, calibración, especificaciones de diseño, dispositivos de sujeción, mecanismos de retracción y normas de calidad industrial. Esta representación técnica es fundamental para la verificación de cumplimiento normativo en la fabricación y comercialización de herramientas de medición en territorio nacional. El documento técnico sirve como referencia para peritos en metrología y autoridades encargadas de la vigilancia de normas oficiales mexicanas.

**Gemini 2.5 Flash Lite** (1.2s):

> TIPO: Figura.
IDENTIFICADORES LEGALES: No aplicable.
CONTENIDO LITERAL: Cinta métrica, carrete, cinta de medir, gancho de sujeción.
VOCABULARIO DE BUSQUEDA: Herramienta de medición, instrumento de metrología, dispositivo de medición, cinta de acero, cinta flexible, calibración, inspección, construcción, arquitectura, ingeniería, topografía.

**GPT-5.4 Nano** (2.8s):

> Tipo: diagrama esquemático con forma de burbuja de texto y un recuadro con un símbolo. Identificadores legales: no se observan números de artículo, fracciones, incisos, nombre de ley, reglamento, decreto, norma oficial mexicana (NOM) ni referencia a DOF o fecha. Contenido literal: no hay texto ni términos escritos legibles; solo se aprecian un icono de comunicación representado por una burbuja con un círculo interior y un bloque con un trazo tipo “T”. Vocabulario de búsqueda: diagrama conceptual, esquema de comunicación, iconografía de mensajes, representación de interacción entre elementos, símbolo de entrada/salida en documentación.

**Qwen 3.6 Flash** (0s): ERROR: Error code: 429 - {'error': {'message': 'Provider returned error', 'code': 429, 'metadata': {'raw': 'qwen/qwen3.6-flash is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rate limits: https://openrouter.ai/settings/integrations', 'provider_name': 'Alibaba', 'is_byok': False}}, 'user_id': 'user_3APl337T9uOHPSkFYDp90QEwLcn'}

**Qwen 3.5 Flash** (17.6s):

> Figura técnica que ilustra un rollo de cinta adhesiva y un mecanismo de dispensación vertical. El diagrama representa elementos físicos utilizados para el sellado de envases o la preservación de integridad en documentos y mercancías. Aunque no presenta texto legal explícito, este tipo de representaciones suele asociarse a Normas Oficiales Mexicanas (NOM) sobre empaque, etiquetado o seguridad de productos. Los términos técnicos incluyen cinta adhesiva, mecanismo de corte, soporte vertical y rollo continuo. Esta representación es relevante para búsquedas sobre requisitos de empaque, sellos de seguridad o métodos de cierre hermético en normativas comerciales. Se utiliza para definir especificaciones físicas de materiales de sellado en contextos regulatorios.

**Claude 3 Haiku** (2.1s):

> TIPO: Diagrama
IDENTIFICADORES LEGALES: No se observan referencias legales en la imagen.
CONTENIDO LITERAL: La imagen muestra dos formas geométricas: un círculo y una figura rectangular.
VOCABULARIO DE BUSQUEDA: diagrama, formas geométricas, círculo, rectángulo, representación gráfica, ilustración.

</details>

---

### Imagen 02 — Diagrama técnico de componente mecánico

![Diagrama técnico de componente mecánico](/images/posts/model-comparison/img02.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
> erpendiculares al eje longitudinal de la cinta, ser claras, exactas y resistentes al uso. La longitud de las líneas deben ser variables en razón directa del valor mayor que limitan las unidades con números de orden indicados con caracteres arábigos, por lo menos para los decímetros y unidades mayores. Las cintas tipo 1 deben subdividirse en milímetros en toda su extensión; las cintas tipo 2, deben subdividirse por lo menos en decímetros y el primer decímetro subdividido en milímetros, tanto las tolerancias de longitud como la carga a que debe sujetarse la cinta para medir su exactitud se indican en la tabla 1, comprobándose como se establece en 7.1
> 
> **FIGURA 1** Flexómetro con cinta métrica 
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (2.2s):

> TIPO diagrama técnico de componentes mecánicos. IDENTIFICADORES LEGALES NOM-001-SEDE-2012 instalaciones eléctricas, NOM-008-SCFI-2002 sistema general de unidades de medida, Ley Federal sobre Metrología y Normalización. CONTENIDO LITERAL representación esquemática de dispositivo de acoplamiento, mecanismo de sujeción, eje de rotación, elementos de fijación y componentes de ensamble industrial. VOCABULARIO DE BUSQUEDA especificaciones técnicas de seguridad industrial, normas oficiales mexicanas de ingeniería, dispositivos de control electromecánico, elementos de sujeción mecánica, cumplimiento de estándares de manufactura, diseño de componentes para infraestructura eléctrica, normatividad de seguridad en maquinaria y equipo. Este diagrama ilustra la configuración geométrica de un mecanismo de precisión sujeto a regulaciones de seguridad y calidad industrial en México. La representación técnica facilita la identificación de partes críticas para auditorías de cumplimiento normativo y peritajes de ingeniería.

**Gemini 2.5 Flash Lite** (1.2s):

> TIPO: Figura.
IDENTIFICADORES LEGALES: No se infieren identificadores legales específicos de la imagen.
CONTENIDO LITERAL: Se muestran dos vistas de un carrete de manguera, una frontal y otra lateral. La vista frontal muestra un disco circular con un eje central y una manivela. Una manguera se extiende desde el carrete con un conector en el extremo. La vista lateral muestra la profundidad del carrete con múltiples capas o discos.
VOCABULARIO DE BUSQUEDA: Carrete de manguera, equipo contra incendios, manguera de agua, extintor, dispositivo de enrollado, sistema de manguera, seguridad industrial, prevención de incendios.

**GPT-5.4 Nano** (2.3s):

> TIPO: diagrama esquemático. IDENTIFICADORES LEGALES: no se aprecian en la imagen artículos, fracciones, incisos, nombre de ley, reglamento, decreto, NOM, DOF ni fecha. CONTENIDO LITERAL: no hay texto legible ni valores numéricos, rangos, claves o abreviaturas visibles. VOCABULARIO DE BUSQUEDA: diagrama conceptual, símbolo de “cambio/versión” o “identidad” del documento, comparación estructural, flujo de información, representación gráfica de procesos administrativos o técnicos. TEMA PROBABLE: ilustración genérica de transformación/actualización de un elemento (por ejemplo, registro o documento) y su relación con una secuencia de pasos. Contexto legal inferido: ninguno, ya que no aparecen referencias normativas explícitas.

**Qwen 3.6 Flash** (274.3s):

> Diagrama técnico que presenta la vista superior y el perfil lateral de un mecanismo de cierre, identificado como un sello de seguridad o candado, mostrando la cerradura central y el elemento de inserción. La ilustración detalla la geometría del dispositivo, incluyendo la forma circular del cuerpo y la estructura rectangular de la cerradura. Se observa un componente separado que representa la llave o el pasador de seguridad necesario para el accionamiento. Este tipo de representación gráfica se utiliza habitualmente en reglamentos o normas técnicas para especificar las características físicas de los dispositivos de seguridad. Los términos legales y técnicos relevantes para la indexación incluyen sello de seguridad, candado, mecanismo de cierre, vista en planta, vista en alzado y especificaciones de seguridad.

**Qwen 3.5 Flash** (9.3s):

> Esta imagen corresponde a un diagrama técnico esquemático que ilustra un mecanismo de cierre circular. La figura presenta una vista en planta y una vista lateral del dispositivo, mostrando su estructura interna y profundidad. Se observa un anillo concéntrico con un elemento central que funciona como pestillo o llave, acompañado de una flecha que indica el sentido de operación o apertura. No se identifican referencias legales explícitas como artículos, normas oficiales o decretos en el dibujo. El contenido técnico sugiere un mecanismo de seguridad o candado de alta resistencia utilizado en instalaciones protegidas. Los términos clave para la búsqueda incluyen diagrama de cerradura, mecanismo de bloqueo, vista técnica y seguridad física. Este tipo de ilustraciones suele acompañar reglamentos de seguridad o normas técnicas sobre dispositivos de protección. La descripción se centra en la funcionalidad mecánica del dispositivo representado sin detalles estéticos.

**Claude 3 Haiku** (2.2s):

> TIPO: Diagrama
IDENTIFICADORES LEGALES: N/A
CONTENIDO LITERAL: El diagrama muestra dos vistas de un objeto circular con una forma interior en forma de flecha apuntando hacia la izquierda.
VOCABULARIO DE BUSQUEDA: diagrama, objeto circular, forma interior, flecha, indexacion, representacion grafica, ilustracion tecnica

</details>

---

### Imagen 03 — Logotipo del Instituto Federal Electoral (IFE)

![Logotipo del Instituto Federal Electoral (IFE)](/images/posts/model-comparison/img03.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
> l 25 de mayo de 1999, de manera que el Instituto Federal Electoral esté en aptitud de suscribir convenios de apoyo y colaboración directamente con las Agrupaciones Políticas Nacionales. En todo caso, dichos convenios tendrán que ser aprobados con anterioridad por la Comisión de Capacitación Electoral y Educación Cívica.
> 
> **CUARTO.-** Notifíquese por oficio el presente Acuerdo a las Agrupaciones Políticas Nacionales.
> 
> **QUINTO.-** Publíquese el presente Acuerdo en el **Diario Oficial de la Federación**.
> 
> El presente acuerdo fue aprobado en sesión extraordinaria del Consejo General celebrada el 16 de diciembre de 2004.- El Consejero Presidente del Consejo General, **Luis Carlos Ugalde Ramírez*
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (2.0s):

> TIPO: Logotipo institucional y emblema oficial. IDENTIFICADORES LEGALES: Instituto Federal Electoral IFE, organismo constitucional autónomo encargado de la organización de las elecciones federales en México conforme al Código Federal de Instituciones y Procedimientos Electorales COFIPE. CONTENIDO LITERAL: IFE, INSTITUTO FEDERAL ELECTORAL. VOCABULARIO DE BUSQUEDA: Autoridad electoral, sistema democrático mexicano, procesos electorales federales, padrón electoral, credencial para votar, antecedente del Instituto Nacional Electoral INE, derecho electoral, administración pública federal, normativa electoral mexicana. Este elemento gráfico identifica la documentación oficial, comunicados y resoluciones emitidas por la autoridad electoral antes de su transición al INE en 2014. La imagen representa la identidad institucional del órgano responsable de garantizar la legalidad, certeza, independencia, imparcialidad y objetividad en los comicios.

**Gemini 2.5 Flash Lite** (1.0s):

> FIGURA: Logo del Instituto Federal Electoral (IFE). CONTENIDO LITERAL: IFE, INSTITUTO FEDERAL ELECTORAL. VOCABULARIO DE BUSQUEDA: Instituto Federal Electoral, IFE, logo institucional, organismo electoral, elecciones federales, derecho electoral mexicano.

**GPT-5.4 Nano** (1.6s):

> TIPO: logotipo institucional. IDENTIFICADORES LEGALES: Instituto Federal Electoral (IFE). CONTENIDO LITERAL: “IFE” y “INSTITUTO FEDERAL ELECTORAL”. VOCABULARIO DE BUSQUEDA: autoridad electoral mexicana, Instituto Federal Electoral, órgano electoral, marco normativo electoral, sistema electoral mexicano, credencialización y procesos electorales. Referencia contextual: institución relacionada con la regulación y organización de elecciones en México conforme a la legislación electoral vigente.

**Qwen 3.6 Flash** (5.4s):

> Esta imagen corresponde al logotipo oficial del Instituto Federal Electoral, identificado por sus siglas IFE. El emblema contiene textualmente las siglas IFE en mayúsculas y el nombre completo INSTITUTO FEDERAL ELECTORAL dispuesto en la parte inferior. Se trata de la marca gráfica de la autoridad electoral federal mexicana que operó antes de la transición al Instituto Nacional Electoral. El contenido literal extrae las siglas IFE y la denominación institucional completa como elementos de identificación legal. Este logotipo representa a la entidad encargada de la organización de los procesos electorales federales en el territorio nacional. Los términos de búsqueda relevantes incluyen IFE, Instituto Federal Electoral, logo institucional y autoridad electoral mexicana.

**Qwen 3.5 Flash** (19.4s):

> La imagen corresponde a un logotipo institucional que representa al Instituto Federal Electoral de México. El diseño presenta las siglas IFE en mayúsculas junto a un símbolo gráfico compuesto por una figura geométrica y una línea horizontal. Debajo de las siglas se encuentra el nombre completo de la institución escrito en mayúsculas como INSTITUTO FEDERAL ELECTORAL. Este organismo fue la autoridad electoral federal encargada de organizar las elecciones en México antes de su transformación en el Instituto Nacional Electoral. Los términos clave para la búsqueda incluyen derecho electoral, ley general de instituciones y procedimientos electorales, y organismos públicos electorales. Es relevante para consultas sobre la historia de la regulación electoral en el país y la normativa aplicable a los procesos de votación federal.

**Claude 3 Haiku** (4.7s):

> TIPO: Logotipo
IDENTIFICADORES LEGALES: Instituto Federal Electoral (IFE)
CONTENIDO LITERAL: La imagen muestra el logotipo del Instituto Federal Electoral (IFE) de México. Consta de un triángulo amarillo y el texto "IFE INSTITUTO FEDERAL ELECTORAL" en negro.
VOCABULARIO DE BUSQUEDA: Autoridad electoral, organismo público, elecciones, proceso electoral, padrón electoral, credencial de elector, voto, democracia, México.

</details>

---

### Imagen 04 — Logotipo de la Secretaría de Salud

![Logotipo de la Secretaría de Salud](/images/posts/model-comparison/img04.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
> El Comité de Moléculas Nuevas de la Comisión Federal para la Protección contra Riesgos Sanitarios, quedará constituido a más tardar treinta días después de la publicación del presente Decreto, y deberá aprobar y publicar en el Diario Oficial de la Federación su Reglamento Interior a más tardar noventa días después de haber quedado constituido.
> 
> Dado en la Residencia del Poder Ejecutivo Federal, en la Ciudad de México, Distrito Federal, a los veinte días del mes de diciembre de dos mil siete.- **Felipe de Jesús Calderón Hinojosa**.- Rúbrica.- El Secretario de Salud, **José Ángel Córdova Villalobos**.- Rúbrica.
> 
> ## CALENDARIO de gasto del Presupuesto de Egresos de la Federación 2008.
> 
> ### Al m
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (2.5s):

> TIPO: Logotipo institucional oficial de la administración pública federal mexicana. IDENTIFICADORES LEGALES: Secretaría de Salud, Gobierno de México, Ley Orgánica de la Administración Pública Federal, artículo 39. CONTENIDO LITERAL: SALUD, SECRETARÍA DE SALUD, ESTADOS UNIDOS MEXICANOS. VOCABULARIO DE BUSQUEDA: Identidad institucional, normativa de comunicación social, imagen oficial del gobierno federal, dependencia del poder ejecutivo, sector salud, administración pública, normatividad de identidad gráfica, documentos oficiales de la Secretaría de Salud. Este elemento gráfico identifica la autoridad sanitaria nacional responsable de la ejecución de políticas públicas en materia de salud en México. Su presencia valida la autenticidad y el carácter oficial de los documentos, circulares, decretos o acuerdos emitidos por esta dependencia gubernamental.

**Gemini 2.5 Flash Lite** (1.5s):

> TIPO: Logotipo.
IDENTIFICADORES LEGALES: Estados Unidos Mexicanos, Secretaría de Salud.
CONTENIDO LITERAL: SALUD, SECRETARÍA DE SALUD.
VOCABULARIO DE BUSQUEDA: Secretaría de Salud, Gobierno de México, Salud Pública, Instituciones de Salud, Administración Pública Federal.

**GPT-5.4 Nano** (1.6s):

> TIPO: logotipo institucional. IDENTIFICADORES LEGALES: Secretaría de Salud, Estados Unidos Mexicanos, sin artículo ni fracción. CONTENIDO LITERAL: “SALUD”, “SECRETARÍA DE SALUD”, “SALUD” y el emblema con “Estados Unidos Mexicanos”. VOCABULARIO DE BUSQUEDA: Secretaría de Salud, institución pública federal mexicana, emblema institucional de Estados Unidos Mexicanos, documentos del sector salud, identificación de autoridad sanitaria.

**Qwen 3.6 Flash** (13.3s):

> Esta imagen es el logotipo institucional de la Secretaría de Salud de México. Contiene el término SALUD y el texto SECRETARÍA DE SALUD. Incluye el escudo nacional con la leyenda ESTADOS UNIDOS MEXICANOS. Este emblema identifica a la autoridad sanitaria federal del gobierno mexicano. Representa la institución encargada de las políticas de salud pública. Sirve como cabecera oficial para documentos del ministerio.

**Qwen 3.5 Flash** (7.6s):

> Esta imagen corresponde al logotipo institucional oficial de la Secretaría de Salud de México. Muestra el escudo nacional con la leyenda ESTADOS UNIDOS MEXICANOS junto al término SALUD en mayúsculas. Debajo del emblema se encuentra el nombre completo de la dependencia SECRETARÍA DE SALUD. Este tipo de imagen identifica documentos oficiales emitidos por el gobierno federal en materia de salud pública. Los términos de búsqueda relevantes incluyen Secretaría de Salud, dependencia federal y autoridad sanitaria. Es fundamental para identificar la procedencia de normativas y decretos sanitarios. La imagen representa la autoridad administrativa en materia de salud a nivel nacional.

**Claude 3 Haiku** (1.8s):

> TIPO: Logotipo
IDENTIFICADORES LEGALES: Secretaría de Salud, Gobierno de México
CONTENIDO LITERAL: SALUD
VOCABULARIO DE BUSQUEDA: logotipo, emblema, símbolo, dependencia gubernamental, ministerio de salud, servicios de salud pública, normatividad sanitaria, instituciones de salud, documentos oficiales de salud

</details>

---

### Imagen 05 — Imagen de documento oficial 2010

![Imagen de documento oficial 2010](/images/posts/model-comparison/img05.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
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
> \- Recipiente portátil
> 
> \- Madera de 0,025 ± 0,005 x 1 ± 0,01 x 1 ± 0,01 m.
> 
> \- Cuña construida según figura 1, cuyo grosor 
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (3.2s):

> TIPO grafica de barras comparativa que ilustra la dinámica comercial internacional. IDENTIFICADORES LEGALES el contenido se relaciona con regulaciones de comercio exterior, tratados internacionales y políticas de salvaguardas comerciales aplicables a productos provenientes de China. CONTENIDO LITERAL los ejes y categorías incluyen Mercado interno, Consumo interno, Producción y Exportaciones de China. VOCABULARIO DE BUSQUEDA análisis de mercado, balanza comercial, dumping, medidas de defensa comercial, importaciones, flujo de mercancías, política arancelaria y competencia desleal. La representación visual contrasta los niveles de consumo y producción nacional frente al volumen de exportaciones de China. Este material es relevante para expedientes de investigación sobre prácticas desleales de comercio internacional y determinación de daño a la industria nacional conforme a la Ley de Comercio Exterior.

**Gemini 2.5 Flash Lite** (1.7s):

> TIPO: Grafica de barras.
IDENTIFICADORES LEGALES: No aplica.
CONTENIDO LITERAL: Las graficas comparan "Consumo interno", "Producción" y "Exportaciones de China" dentro del "Mercado interno". Se observa una barra pequeña para "Consumo interno" y "Producción", y una barra significativamente mayor para "Exportaciones de China" en ambas graficas.
VOCABULARIO DE BUSQUEDA: Mercado interno, consumo interno, producción, exportaciones, comercio exterior, balanza comercial, análisis de mercado, competencia internacional.

**GPT-5.4 Nano** (2.4s):

> TIPO: grafica de barras comparativa. IDENTIFICADORES LEGALES: no se observan en la imagen artículos, fracciones, incisos, nombres de leyes o reglamentos, ni referencias a DOF, fechas, NOM o decretos; solo aparecen conceptos de mercado. CONTENIDO LITERAL: se muestran las categorías “Consumo interno”, “Producción”, “Exportaciones de China” y el rótulo “Mercado interno”. VOCABULARIO DE BUSQUEDA: comercio internacional, exportaciones, consumo interno, producción, análisis de mercado, competencia externa, participación de mercado, China, estimaciones de mercado interno. También se aprecia una línea divisoria sin referencia legal explícita y valores cuantitativos no legibles en el fragmento, por lo que la indexación debe enfocarse en las categorías textuales del esquema.

**Qwen 3.6 Flash** (12.8s):

> Se trata de una grafica de barras que muestra la distribucion de variables economicas bajo el titulo Mercado interno. Los ejes horizontales detallan las categorias Consumo interno, Produccion y Exportaciones de China. Los datos visuales indican una magnitud significativamente mayor para las Exportaciones de China en comparacion con el Consumo interno y la Produccion. No se observan identificadores legales especificos como articulos, fracciones o normas oficiales en la imagen. El vocabulario de busqueda relevante incluye terminos como comercio exterior, balanza comercial, flujos comerciales, mercado domestico y economia internacional.

**Qwen 3.5 Flash** (12.1s):

> (empty response)

**Claude 3 Haiku** (2.8s):

> TIPO: Gráfica
IDENTIFICADORES LEGALES: N/A
CONTENIDO LITERAL: Mercado interno, Consumo interno, Producción, Exportaciones de China
VOCABULARIO DE BUSQUEDA: Mercado interno, consumo interno, producción, exportaciones, China, análisis de mercado, datos económicos, estadísticas sectoriales

</details>

---

### Imagen 06 — Formato de certificación de gasto (Caravanas de la Salud)

![Formato de certificación de gasto (Caravanas de la Salud)](/images/posts/model-comparison/img06.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
> valor total de la producción de las empresas beneficiarias del cupo en los tres años calendario anteriores al inicial del periodo de vigencia del cupo para el cual solicita asignación, ponderada por 0.35; más
> 
> > c\. La participación del valor de las inversiones en activos fijos realizadas en México por cada empresa, en el valor total de las inversiones de las empresas beneficiarias del cupo en los tres años calendario anteriores al inicial del periodo de vigencia del cupo para el cual solicita asignación, ponderado por 0.20.
> 
> > Todo lo anterior multiplicado por el monto del cupo total del periodo de vigencia que corresponda, descontando los montos señalados en el primer párrafo de la fracció
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (2.5s):

> TIPO tabla de control administrativo y formato de certificación de gasto. IDENTIFICADORES LEGALES Anexo 4 del Programa Caravanas de la Salud ejercicio 2014 emitido por la Dirección General de Planeación y Desarrollo en Salud de la Secretaría de Salud federal. CONTENIDO LITERAL incluye campos para Entidad Federativa, Monto por concepto de gasto, Concepto de Gasto de Aplicación, Nombre del Concepto de Gasto, Fecha de elaboración, Partida Específica, Número Factura Pagada, Póliza Cheque, Fecha Pol-Cheque, Mod. Adquisición, Contrato o Pedido, Proveedor o Prestador de Servicios, Importe, Observaciones y Total Acumulado con valor 0.00. El documento contiene una leyenda de cumplimiento de requisitos fiscales, administrativos y normativos vigentes conforme al convenio de coordinación y transferencia de recursos. VOCABULARIO DE BUSQUEDA rendición de cuentas, comprobación de gastos, fiscalización de recursos públicos, transparencia presupuestaria, auditoría gubernamental, ejercicio fiscal 2014, comprobantes fiscales, gestión administrativa, validación de egresos y normatividad de salud. Este formato es utilizado para la comprobación documental de recursos federales transferidos a las entidades federativas bajo el esquema de convenios de coordinación.

**Gemini 2.5 Flash Lite** (2.0s):

> TIPO: Formato.
IDENTIFICADORES LEGALES: Ejercicio 2014, Anexo 4, Programa Caravanas de la Salud, Secretaría de Salud.
CONTENIDO LITERAL: Entidad Federativa, Concepto de Gasto de Aplicación, Nombre del Concepto de Gasto, Monto por concepto de gasto, Fecha de elaboración, Partida Específica, Número Factura Pagada, Póliza Cheque, Fecha Pol-Cheque, Mod. Adquisición, Contrato o Pedido, Proveedor o Prestador de Servicios, Importe, Observaciones, TOTAL ACUMULADO 0.00.
VOCABULARIO DE BUSQUEDA: Formato de certificación de gasto, gastos de operación, programa de salud, ejercicio fiscal, concepto de gasto, partida específica, número de factura, póliza de cheque, fecha de póliza, modalidad de adquisición, contrato, pedido, proveedor, prestador de servicios, importe, observaciones, total acumulado, documentación comprobatoria, requisitos fiscales, administrativos, normativos, convenio de coordinación, transferencia de recursos, Secretaría de Salud, Director de Administración, Secretario de Salud.

**GPT-5.4 Nano** (4.7s):

> TIPO: formulario/tabla de formato de certificación de gasto para registro contable y administrativo. IDENTIFICADORES LEGALES: “DIRECCIÓN GENERAL DE PLANEACIÓN Y DESARROLLO EN SALUD”, “PROGRAMA CARAVANAS DE LA SALUD”, “EJERCICIO 2014”, “FORMATO DE CERTIFICACIÓN DE GASTO PARA “GASTOS DE OPERACIÓN””, “ANEXO 4”, y referencia institucional “SECRETARÍA DE SALUD” y texto de “LA DOCUMENTACION ORIGINAL COMPROBATORIA CORRESPONDIENTE CUMPLE CON LOS REQUISITOS FISCALES, ADMINISTRATIVOS Y NORMATIVOS VIGENTES”. CONTENIDO LITERAL: columnas y campos con sus encabezados “Entidad Federativa”, “Concepto de Gasto de Aplicación”, “Fecha de elaboración”, “Partida Específica”, “Número Factura Pagada”, “Póliza Cheque”, “Fecha Pol-Cheque”, “Mod. Adquisición”, “Contrato o Pedido”, “Proveedor o Prestador de Servicios”, “Importe”, “Observaciones”, además de “TOTAL ACUMULADO” y el valor “0.00”; numerales de ubicación “1”, “2”, “3”, “4”, “5”, “6”, “7”, “8”, “9”, “10”, “11”, “12”, “13”, “14”, “15”, “16”, “17”, “18”, “19”, “Vo. Bo.” y “MES”. VOCABULARIO DE BUSQUEDA: “certificación de gasto”, “gastos de operación”, “programa presupuestario”, “comprobación de gastos”, “requisitos fiscales”, “requisitos administrativos”, “normativos vigentes”, “documentación original”, “transferencia de recursos”, “coordinación”, “autorización”, “director de administración”, “secretario de salud”, “póliza cheque”, “número de factura pagada”, “contrato o pedido”, “mod. adquisición”, “proveedor o prestador de servicios”, “importe” y “observaciones”.

**Qwen 3.6 Flash** (9.6s):

> Esta imagen corresponde al Anexo 4 del programa Caravanas de la Salud del ejercicio 2014, titulado Formato de Certificación de Gasto para Gastos de Operación, emitido por la Dirección General de Planeación y Desarrollo en Salud de la Secretaría de Salud. El documento estructura la información financiera mediante campos para la Entidad Federativa, el Concepto de Gasto de Aplicación y el Monto por concepto de gasto. Incluye una tabla con columnas específicas para Partida Específica, Número Factura Pagada, Póliza Cheque, Fecha Pol-Cheque, Mod. Adquisición, Contrato o Pedido, Proveedor o Prestador de Servicios, Importe y Observaciones, cerrando con el campo Total Acumulado. El texto legal inferior certifica que la documentación original comprobatoria cumple con los requisitos fiscales, administrativos y normativos vigentes vinculados al programa y se encuentra para su guarda y custodia conforme al Convenio de Coordinación y Transferencia de Recursos. El formato requiere firmas de Elaboró, Autorizó por el Director de Administración y Vo. Bo. por el Secretario de Salud.

**Qwen 3.5 Flash** (12.0s):

> Este documento es un formato oficial de certificación de gasto para gastos de operación, identificado como Anexo 4 del Programa Caravanas de la Salud del Ejercicio 2014, emitido por la Dirección General de Planeación y Desarrollo en Salud de la Secretaría de Salud. El formulario contiene campos para registrar la Entidad Federativa, el monto por concepto de gasto, el concepto de gasto de aplicación y el nombre del concepto de gasto, junto con la fecha de elaboración. Incluye una tabla detallada con columnas para Partida Especifica, Número Factura Pagada, Póliza Cheque, Fecha Pol-Cheque, Mod. Adquisición, Contrato o Pedido, Proveedor o Prestador de Servicios, Importe y Observaciones. El documento finaliza con un campo para el Total Acumulado y espacios para las firmas de Elaboró, Autorizó por el Director de Administración y Vo. Bo. por el Secretario de Salud. La documentación original comprobatoria debe cumplir con requisitos fiscales, administrativos y normativos vigentes vinculados al programa. Este formato es utilizado para la custodia y revisión de recursos en la Secretaría de Salud Federal o su equivalente en la entidad federativa.

**Claude 3 Haiku** (5.0s):

> TIPO: Formato de certificación de gasto para "Gastos de Operación" del Programa Caravanas de la Salud, Ejercicio 2014.

IDENTIFICADORES LEGALES: Dirección General de Planeación y Desarrollo en Salud, Secretaría de Salud.

CONTENIDO LITERAL: Entidad Federativa, Monto por concepto de gasto, Concepto de Gasto de Aplicación, Fecha de elaboración, Partida Específica, Número Factura Pagada, Póliza Cheque, Fecha Pól-Cheque, Mod. Adquisición, Contrato o Pedido, Proveedor o Prestador de Servicios, Importe, Observaciones, Total Acumulado.

VOCABULARIO DE BUSQUEDA: Formato de certificación de gasto, Programa Caravanas de la Salud, Secretaría de Salud, Dirección General de Planeación y Desarrollo en Salud, partidas presupuestales, proveedores, contratación de servicios, documentación administrativa.

</details>

---

### Imagen 07 — Tablas de la Comisión Nacional de Hidrocarburos (CNH)

![Tablas de la Comisión Nacional de Hidrocarburos (CNH)](/images/posts/model-comparison/img07.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
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
> \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (3.0s):

> TIPO tabla de reporte administrativo y técnico de la Comisión Nacional de Hidrocarburos CNH. IDENTIFICADORES LEGALES documentos oficiales de la Comisión Nacional de Hidrocarburos bajo el marco regulatorio de CONAMER. CONTENIDO LITERAL la primera tabla detalla Actividad e Inversión con columnas para Instalación Concepto u Obra Costo Total Ejercicio al año 20XX Monto de Inversión en Millones de Pesos desglosado por meses de Enero a Diciembre y Programado a Ejercer 20XX. La segunda tabla corresponde a Evaluación con indicadores de Promedio anual MMPCD Vol anual MMPC Valor del Gas Ingreso MMPesos Gasto de Operación MMPesos y Servicio de compresión MMPesos distribuidos en 18 años. La tercera tabla denominada Máxima RGA presenta las columnas Formación RGA m3/m3 Actual y Máxima. VOCABULARIO DE BUSQUEDA sector energético mexicano hidrocarburos planeación financiera presupuestal evaluación de proyectos petroleros relación gas aceite RGA infraestructura de extracción y procesamiento de gas natural.

**Gemini 2.5 Flash Lite** (2.5s):

> TIPO: Tabla. IDENTIFICADORES LEGALES: Comisión Nacional de Hidrocarburos, Parte 16 de 18, Parte 17 de 18, Parte 18 de 18. CONTENIDO LITERAL: Instalación, Concepto/Obra, Costo Total (Millones de Pesos), Ejercicio al año 2010X (Millones de pesos), Monto de Inversión (Millones de Pesos) Enero, Febrero, Marzo, Abril, Mayo, Junio, Julio, Agosto, Septiembre, Octubre, Noviembre, Diciembre, Prog. 20XX, Programado 20XX (Millones de pesos), Programado a Ejercer 20XX (Millones de pesos), Inversión Total, Promedio anual (MMPCD), Vol. anual (MMPC), Valor del Gas (Ingreso) (MMPesos), Gasto de Operación (MMPesos), Servicio de compresión (MMPesos), Año 1, Año 2, Año 3, Año 4, Año 5, Año 6, Año 7, Año 8, Año 9, Año 10, Año 11, Año 12, Año 13, Año 14, Año 15, Año 16, Año 17, Año 18, n, Total, Formación, Actual, RGA (m³/m³), Máxima. VOCABULARIO DE BUSQUEDA: Inversión en hidrocarburos, costos de operación, ingresos por gas, inversión programada, inversión ejercida, producción anual de hidrocarburos, RGA máxima, RGA actual, Comisión Nacional de Hidrocarburos, datos financieros, presupuesto de inversión, ejercicio fiscal.

**GPT-5.4 Nano** (4.1s):

> TIPO: tabla de proyección y evaluación con secciones “Parte 16 de 18 Actividad e Inversión”, “Parte 17 de 18 Evaluación” y “Parte 18 de 18 Máxima RGA” de la Comisión Nacional de Hidrocarburos. IDENTIFICADORES LEGALES: aparece “Comisión Nacional de Hidrocarburos”, “CONAMER” y “CNH”, además de “Gobierno de México” y referencias de contacto; también se infiere el marco de evaluación regulatoria al mostrar “RGA (m3/m3)” y “Máxima”. CONTENIDO LITERAL: secciones y encabezados que incluyen “Inversión Total”, “Monto de Inversión (Millones de Pesos)”, “Programado 2020” y “Programado Prog. XX” (con “Programado por FJ (Millones de pesos)”) y, en la Parte 17, “Promedio anual (MMPCD)”, “Vol. anual (MMP…”), “Valor del Gas (ingreso) (MM…)”, “Gasto de Operación (MM…)”, “Servicio de compresión (MM…)”, “Total”; en la Parte 18 se observan “Formación”, “RGA (m3/m3)”, “Actual” y “Máxima”. VOCABULARIO DE BUSQUEDA: actividad e inversión en hidrocarburos, evaluación de proyectos, programación anual, volumen promedio anual, volumen anual, valor del gas, gasto de operación, servicio de compresión, formación geológica, régimen o relación RGA, máxima RGA, Comisión Nacional de Hidrocarburos, CNH, CONAMER, gobierno de México.

**Qwen 3.6 Flash** (10.9s):

> La imagen muestra tres tablas administrativas de la Comisión Nacional de Hidrocarburos correspondientes a las partes 16, 17 y 18 de un reporte oficial. La Parte 16, Actividad e Inversión, detalla el costo total y los montos de inversión ejecutados y programados mensualmente en millones de pesos para distintas instalaciones y conceptos de obra. La Parte 17, Evaluación, presenta una tabla con indicadores anuales como promedio anual en MMPCD, volumen anual en MMPC, valor del gas en ingreso, gasto de operación y servicio de compresión, proyectados de año 1 a año 18 en millones de pesos. La Parte 18, Máxima RGA, contiene una tabla que compara la formación actual con la máxima RGA expresada en metros cúbicos por metro cúbico. Los documentos incluyen encabezados institucionales de gob.mx, Gobierno de México, CONAMER y la CNH, junto con datos de contacto en Benito Juárez, Ciudad de México. Los términos técnicos relevantes incluyen RGA, MMPCD, MMPC, MMPesos y desgloses financieros de inversión y operación.

**Qwen 3.5 Flash** (8.4s):

> La imagen presenta tres tablas consecutivas de un documento oficial de la Comisión Nacional de Hidrocarburos bajo el sello del Gobierno de México y CONAMER. La primera sección, titulada Parte 16 de 18 Actividad e Inversión, detalla el Costo Total y Monto de Inversión en Millones de Pesos desglosado por meses del ejercicio 20XX. La segunda sección, Parte 17 de 18 Evaluación, contiene una matriz de proyección financiera anual desde el Año 1 hasta el Año 18, incluyendo conceptos como Promedio anual MMPCD, Vol. anual MMPC, Valor del Gas y Gasto de Operación en MMPesos. La tercera sección, Parte 18 de 18 Máxima RGA, muestra una tabla para registrar la Formación y el RGA en m³/m³ comparando los valores Actual y Máxima. Todos los campos numéricos en las tablas muestran un valor inicial de cero. El documento incluye la dirección de contacto en Avenida Petróleos 580, colonia Noroeste, Benito Juárez, Ciudad de México.

**Claude 3 Haiku** (4.7s):

> TIPO: Tabla
IDENTIFICADORES LEGALES: Parte 16 de 18 Actividad e Inversión, Parte 17 de 18 Evaluación, Parte 18 de 18 Máxima RGA, Comisión Nacional de Hidrocarburos
CONTENIDO LITERAL: Inversión Total, Promedio anual (MMPCD), Valor anual (MMPCD), Valor del Gas (MMPCD), Servicio de compresión (MMPCD), Formación, Actual, RGA (m³/m³), Máxima
VOCABULARIO DE BUSQUEDA: Actividad, inversión, evaluación, máxima RGA, hidrocarburos, gas, compresión, formación, producción, extracción, normativa, regulación, estadísticas, indicadores, reportes, documentos legales.

</details>

---

### Imagen 08 — Documento oficial con encabezado

![Documento oficial con encabezado](/images/posts/model-comparison/img08.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
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
> Ciudad de México, a 12 de diciembre de 2019.- Comisionados Integrantes del Órgano de Gobierno de la Comisión Nacional de Hidrocarburos.- El Comisionado Presidente, **Rogelio Hernández Cázares**.- Rúbrica.- Los Comisionados: **Alma América Porres Luna**, **Sergio Henrivier Pimentel Vargas**, **Néstor Martínez Romero**, **Hé
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (2.8s):

> TIPO documento oficial de planeación estratégica emitido por el Instituto Nacional Electoral INE. IDENTIFICADORES LEGALES Plan de Seguridad para el Modelo de Operación de la casilla con Urna Electrónica para los Procesos Electorales Locales 2019-2020 en Coahuila e Hidalgo con fecha de febrero 2020. CONTENIDO LITERAL El texto especifica el alcance geográfico en los estados de Coahuila e Hidalgo y el periodo electoral 2019-2020 bajo la normativa del INE. VOCABULARIO DE BUSQUEDA Este documento es fundamental para la investigación sobre derecho electoral mexicano, sistemas de votación electrónica, integridad de la jornada electoral y protocolos de seguridad en casillas. Los términos clave incluyen urna electrónica, procesos electorales locales, seguridad informática electoral, modelo de operación de casilla y normatividad electoral del INE. El archivo sirve como referencia técnica y legal para el análisis de la implementación de tecnología en los comicios locales de 2020.

**Gemini 2.5 Flash Lite** (1.8s):

> TIPO: Documento.
IDENTIFICADORES LEGALES: Instituto Nacional Electoral, Procesos Electorales Locales 2019-2020, Coahuila, Hidalgo, Febrero 2020.
CONTENIDO LITERAL: Plan de Seguridad para el Modelo de Operación de la casilla con Urna Electrónica.
VOCABULARIO DE BUSQUEDA: Plan de seguridad, urna electrónica, modelo de operación, procesos electorales locales, INE, Coahuila, Hidalgo, 2019, 2020.

**GPT-5.4 Nano** (3.1s):

> TIPO: portada de documento institucional. IDENTIFICADORES LEGALES: Instituto Nacional Electoral (INE), “Plan de Seguridad”, “Modelo de Operación de la casilla con Urna Electrónica”, “Procesos Electorales Locales 2019-2020”, “Coahuila e Hidalgo”, y fecha “Febrero 2020”. CONTENIDO LITERAL: “Instituto Nacional Electoral”, “Plan de Seguridad para el Modelo de Operación de la casilla con Urna Electrónica para los Procesos Electorales Locales 2019-2020 en Coahuila e Hidalgo.” y “Febrero 2020”. VOCABULARIO DE BUSQUEDA: plan de seguridad, casilla, urna electrónica, modelo de operación, procesos electorales locales, INE, Instituto Nacional Electoral, Coahuila, Hidalgo, seguridad en elecciones, planeación de seguridad electoral.

**Qwen 3.6 Flash** (9.0s):

> Esta imagen representa la portada de un documento oficial del Instituto Nacional Electoral (INE) denominado Plan de Seguridad. El texto especifica que el documento regula el Modelo de Operación de la casilla con Urna Electrónica. Esta normativa está dirigida a los Procesos Electorales Locales 2019-2020 en los estados de Coahuila e Hidalgo. La fecha de publicación indicada en el documento es Febrero 2020. El contenido aborda los procedimientos técnicos y de seguridad para la implementación de urnas electrónicas en las casillas.

**Qwen 3.5 Flash** (13.8s):

> This image displays the cover page of a document titled Plan de Seguridad issued by the Instituto Nacional Electoral. The document outlines the security measures for the Modelo de Operación de la casilla con Urna Electrónica during the Procesos Electorales Locales 2019-2020. It specifically applies to the states of Coahuila and Hidalgo and is dated Febrero 2020. The text details the operational security protocols required for polling stations utilizing electronic voting urns. Key concepts covered include electoral security, electronic urns, INE regulations, and local election procedures. It serves as a foundational guide for ensuring the integrity of the voting process in the specified regions. It establishes the framework for security operations during the 2019-2020 electoral cycle.

**Claude 3 Haiku** (3.1s):

> TIPO: Imagen de un documento oficial
IDENTIFICADORES LEGALES: Plan de Seguridad para el Modelo de Operación de la casilla con Urna Electrónica para los Procesos Electorales Locales 2019-2020 en Coahuila e Hidalgo, Febrero 2020
CONTENIDO LITERAL: Plan de Seguridad, Modelo de Operación de la casilla con Urna Electrónica, Procesos Electorales Locales 2019-2020, Coahuila, Hidalgo
VOCABULARIO DE BUSQUEDA: plan de seguridad, modelo de operación, urna electrónica, procesos electorales locales, Coahuila, Hidalgo, Instituto Nacional Electoral, INE, elecciones, documentos legales, normativa electoral

</details>

---

### Imagen 09 — Figura técnica simple

![Figura técnica simple](/images/posts/model-comparison/img09.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
> es Legislativo y Judicial, así como los entes autónomos deberán publicar en el Diario Oficial de la Federación, los ingresos del periodo, incluyendo los rendimientos financieros; egresos; destino y saldo de los fideicomisos en los que participen, en los términos de las disposiciones generales aplicables".
> 
> **SEGUNDO.-** Que de conformidad con lo señalado en el supuesto normativo presupuestal federal en comento, el Instituto Nacional Electoral presenta la siguiente información:
> 
> **INFORME DEL FIDEICOMISO \"FONDO PARA EL CUMPLIMIENTO DEL PROGRAMA DE INFRAESTRUCTURA INMOBILIARIA Y PARA LA ATENCIÓN CIUDADANA Y MEJORAMIENTO DE MÓDULOS DEL INSTITUTO NACIONAL ELECTORAL" CON LA FIDUCIARIA BANCO NACI
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (2.6s):

> TIPO formula matematica o variable tecnica. IDENTIFICADORES LEGALES corresponde a la notacion utilizada en normativas financieras y actuariales como las circulares de la Comision Nacional de Seguros y Fianzas CNSF o disposiciones de caracter general en materia de solvencia y requerimientos de capital. CONTENIDO LITERAL el texto presenta la expresion Var con subindice 1 y 2 seguido de un simbolo de acento circunflejo o gorro y dos puntos. VOCABULARIO DE BUSQUEDA se refiere a la estimacion de varianza, calculo de riesgo, modelos estadisticos de solvencia, requerimientos de capital de solvencia, estimadores de varianza, analisis de riesgo financiero y metodologias actuariales aplicables a instituciones de seguros y fianzas en Mexico. Esta variable es fundamental para la determinacion de los requerimientos de capital bajo el marco de Solvencia II en el sector asegurador mexicano.

**Gemini 2.5 Flash Lite** (1.0s):

> TIPO: Figura.
IDENTIFICADORES LEGALES: Articulo 12, Fraccion II, Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares.
CONTENIDO LITERAL: Variaciones.
VOCABULARIO DE BUSQUEDA: Variaciones, Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares, Articulo 12, Fraccion II.

**GPT-5.4 Nano** (2.0s):

> Tipo: fragmento de texto de un documento legal. Identificadores legales: aparece la abreviatura “Var” seguida del símbolo “4”, sin referencia adicional visible a artículos, fracciones, incisos, ley, reglamento, decreto, NOM o DOF. Contenido literal: “Var4”. Vocabulario de búsqueda: términos para búsqueda relacionados con “Var4”, abreviaturas de variables, claves internas de documentos, numeración de variables en documentos regulatorios y extracción de texto para indexación RAG. También puede asociarse a un campo o variable técnica dentro de un formato de expediente o base documental.

**Qwen 3.6 Flash** (10.8s):

> Figura que presenta una notación técnica o fórmula matemática compuesta por la abreviatura Var con un subíndice 12 y un superíndice A. Esta representación visual corresponde a una variable estadística o parámetro numérico utilizado en contextos normativos o reglamentarios. El contenido literal identifica claramente los caracteres Var, el número 12 en posición inferior y la letra A en posición superior. Se trata de un elemento gráfico que define un valor específico dentro de un cálculo o procedimiento establecido en la normativa. Los términos de búsqueda apropiados incluyen varianza, notación matemática, subíndice, superíndice, variable técnica y fórmula estadística.

**Qwen 3.5 Flash** (29.1s):

> Se trata de una expresión matemática o fórmula estadística. No se identifican referencias legales explícitas como artículos, fracciones o números de norma oficial mexicana en la imagen. El contenido literal muestra la abreviatura Var con un subíndice 12 y un superíndice A. Esta notación sugiere una variable técnica o un cálculo de varianza específico dentro de un documento técnico. Los términos de búsqueda relevantes incluyen Var, 12, A, fórmula, variable. También son útiles notación matemática, subíndice, superíndice y cálculo técnico. En un contexto legal, esto podría referirse a un anexo técnico o estándar de medición, permitiendo la indexación adecuada para la recuperación de información técnica.

**Claude 3 Haiku** (2.3s):

> TIPO: Diagrama
IDENTIFICADORES LEGALES: Artículo 4, Fracción I, Inciso a
CONTENIDO LITERAL: Variar, Variación, Variabilidad
VOCABULARIO DE BUSQUEDA: Variación, variabilidad, cambio, modificación, fluctuación, alteración, ley, reglamento, normativa, regulación, legislación, artículo, fracción, inciso

</details>

---

### Imagen 10 — Figura técnica simple

![Figura técnica simple](/images/posts/model-comparison/img10.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
> os A, B, E y F de la actual Sección Primera, Capítulo V, Título Segundo para quedar como siguen "De la Metodología General Estándar para la calificación de Cartera Crediticia de Consumo no Revolvente", "De la Metodología General Estándar para la calificación de Cartera Crediticia de Consumo correspondiente a operaciones de tarjeta de crédito y otros créditos revolventes", "De la cobertura por riesgo de crédito", "De la Metodología General Estándar para la Cartera Crediticia de Microcrédito" respectivamente; 91; 91 Bis; 91 Bis 1, fracciones I, inciso a), inciso b), segundo párrafo, II, incisos a) y b) variable, y segundo párrafo, III, inciso a), inciso b) segundo párrafo, IV, incisos a) y b) 
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (6.5s):

> TIPO: Notación matemática o variable técnica utilizada en fórmulas de cálculo financiero o regulatorio. IDENTIFICADORES LEGALES: Este término se emplea frecuentemente en las Disposiciones de Carácter General aplicables a las Instituciones de Crédito emitidas por la Comisión Nacional Bancaria y de Valores CNBV, específicamente en los anexos sobre requerimientos de capital y gestión de riesgos. CONTENIDO LITERAL: La expresión corresponde a la variable Var con superíndice O y subíndice i3. VOCABULARIO DE BUSQUEDA: Representa el valor en riesgo, riesgo de mercado, requerimiento de capital por riesgo, modelos internos de medición de riesgos, solvencia bancaria, activos ponderados por riesgo y suficiencia de capital. Esta variable es fundamental para el cumplimiento de los estándares de Basilea III implementados en la normativa financiera mexicana. El término es utilizado por auditores, analistas de riesgos y autoridades supervisoras para determinar la exposición a pérdidas potenciales en carteras de inversión o instrumentos financieros derivados.

**Gemini 2.5 Flash Lite** (1.3s):

> TIPO: Formula matematica.
IDENTIFICADORES LEGALES: No aplicable.
CONTENIDO LITERAL: Var^0_i3.
VOCABULARIO DE BUSQUEDA: Variable, indice, exponente, formula, notacion matematica.

**GPT-5.4 Nano** (1.9s):

> TIPO: variable o entrada textual con referencia legislativa, identificada como “Varo3”. IDENTIFICADORES LEGALES: no se distinguen en la imagen un numero de articulo, fraccion, inciso, ley, reglamento, decreto, DOF, fecha o norma oficial mexicana (NOM). CONTENIDO LITERAL: “Varo3”. VOCABULARIO DE BUSQUEDA: identificador de campo o clave de sistema para indexacion en documentos legales, busqueda por termino “Varo3” y por referencias abreviadas o codigos internos asociados a expedientes o apartados normativos.

**Qwen 3.6 Flash** (9.0s):

> Figura técnica que presenta la notación matemática Var con el subíndice i3 y el superíndice 0. Esta expresión corresponde a una variable o varianza específica utilizada en cálculos estadísticos o peritales. El término Var funciona como la abreviatura técnica para varianza o variable dependiente. El subíndice i3 identifica un índice particular dentro de una serie de datos o categorías. El superíndice 0 indica generalmente un valor base, inicial o de referencia en la fórmula. Esta notación es relevante en contextos de peritaje contable, análisis de datos forenses o cálculos de indemnizaciones basados en estadísticas. Los términos de búsqueda incluyen varianza, variable, índice, subíndice, superíndice, notación matemática y cálculo técnico.

**Qwen 3.5 Flash** (11.1s):

> Se trata de una fórmula matemática o notación estadística aislada que representa un parámetro técnico. El contenido literal muestra la abreviatura "Var" seguida de un subíndice "i3" y un superíndice "0". No existen referencias normativas, artículos o leyes visibles en la imagen que sirvan como identificadores legales directos. Los términos de búsqueda relevantes incluyen varianza, notación matemática, subíndice, superíndice, modelo estadístico y fórmula. Esta notación es frecuentemente utilizada en informes periciales económicos o análisis de datos cuantitativos dentro de procesos legales. Representa un parámetro específico de varianza condicional o estimada en un contexto de modelado. La indexación debe priorizar los términos técnicos de estadística y matemáticas aplicadas al derecho. Es fundamental para recuperar documentos que contengan análisis econométricos o cálculos de daños.

**Claude 3 Haiku** (2.6s):

> TIPO: Diagrama
IDENTIFICADORES LEGALES: Artículo 2, Fracción I, Inciso a, Ley General de Transparencia y Acceso a la Información Pública
CONTENIDO LITERAL: Var, Var1, Var2
VOCABULARIO DE BUSQUEDA: variables, diagrama, ley de transparencia, acceso a la información pública, términos legales, términos técnicos

</details>

---

### Imagen 11 — Documento con gráfica/tabla extensa

![Documento con gráfica/tabla extensa](/images/posts/model-comparison/img11.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
> la alta dirección capacitados de la Entidad Federativa sobre el nuevo Sistema de Justicia Laboral previo al 1° de octubre de 2020.
> 
> > **2. Indicadores:** Los indicadores son útiles para poder medir con claridad los resultados obtenidos con la aplicación de programas, procesos o acciones específicos, con el fin de obtener el diagnóstico de una situación, comparar las características de una población o para evaluar las variaciones de un evento.
> 
> > Permite identificar las diferencias existentes entre los resultados planeados y obtenidos como base para la toma de decisiones, fijar el rumbo y alinear los esfuerzos hacia la consecución de las metas establecidas con el fin de lograr mejoras en los 
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (3.0s):

> TIPO tabla y capturas de pantalla de sitios web. IDENTIFICADORES LEGALES fiscalización de recursos, rendición de cuentas, contabilidad electoral, sujeto obligado Fernando Tiscareño Luján, Chihuahua Participa A.C., periodo 2017-2018. CONTENIDO LITERAL tabla de pólizas con columnas número de póliza, periodo de operación, tipo de póliza, subtipo póliza, fecha de operación, fecha de registro, descripción póliza, total cargo, total abono, cédula de prorrateo, valores como jornada electoral, corrección, ingresos, diario, montos desde 1,045.49 hasta 1,204,628.56, referencias a www.fuerzaytrabajo.com y Facebook @ftisca. VOCABULARIO DE BUSQUEDA auditoría contable, fiscalización de campañas electorales, transparencia, rendición de cuentas, financiamiento de partidos políticos, derechos reservados, asociación civil, fiscalización de ingresos y egresos, contabilidad gubernamental, fiscalización electoral. La información documenta la relación entre el sujeto obligado y la asociación civil titular de los derechos de las plataformas digitales utilizadas para la difusión de actividades políticas.

**Gemini 2.5 Flash Lite** (3.1s):

> TIPO: Tabla. IDENTIFICADORES LEGALES: No se infieren identificadores legales específicos de la tabla. CONTENIDO LITERAL: Pólizas, Vista previa de póliza, Número de pólizas, Período de operación, Tipo de póliza, Póliza, Fecha de operación, Fecha de registro, Descripción póliza, Total cargo, Total abono, Código de asegurado. Se muestran datos de pólizas con fechas de operación y registro entre julio y septiembre de 2018. VOCABULARIO DE BUSQUEDA: Pólizas, seguros, contratos, operación de pólizas, registro de pólizas, cargos, abonos, códigos de asegurado.

**GPT-5.4 Nano** (3.6s):

> TIPO: captura de pantalla de un sistema/portal con una tabla de “Pólizas” y dos capturas adicionales de páginas en Facebook y sitio web institucional. IDENTIFICADORES LEGALES: referencia contextual a “Chihuahua Patricia, A.C.” y mención de “Fernando Tiscareño #ftica” en Facebook; aparece el identificador “2019EsEsperanza”. CONTENIDO LITERAL: en la sección mostrada se observa el encabezado “Pólizas”, “Total de Pólizas”, y campos de filtro/cálculo con “Página 1 de 1”; en la indicación textual se lee “www.fuerzaytrabajo.com” y “Fernando Tiscareño @ftica”; en el encabezado de la página de Facebook se lee “Foranea” y el texto “#2019EsEsperanza”; en la captura del sitio web se lee “FERNANDO TISCAR EÑO”. VOCABULARIO DE BUSQUEDA: pólizas, registro, comprobantes, constancias, páginas web, redes sociales, Facebook, @ftica, “fuerzaytrabajo.com”, “Chihuahua Patricia, A.C.”, “2019EsEsperanza”, difusión de información, prueba documental digital.

**Qwen 3.6 Flash** (13.4s):

> La imagen muestra una tabla titulada Pólizas que registra movimientos financieros con columnas para Número de póliza, Motivo póliza (como CORRECCION e INGRESOS), Fecha de operación (fechas en 2018 como 01-07-2018) y montos en pesos. El texto adjunto en el apartado b) certifica que los derechos reservados de las páginas www.fuerzaytrabajo.com y "Fernando Tiscareño @tlisca" en Facebook pertenecen a la organización "Chihuahua Participa, A.C.". Se anexan capturas de pantalla que validan esta afirmación, mostrando la interfaz de Facebook con la campaña "#2019EsEsperanza" y el sitio web con el nombre "FERNANDO TISCAREÑO". El documento funciona como evidencia documental para acreditar la titularidad de activos digitales en un contexto que parece ser de auditoría o campaña electoral. Los términos relevantes para la búsqueda incluyen derechos reservados, propiedad intelectual, páginas de campaña, pólizas de ingresos y jornada electoral.

**Qwen 3.5 Flash** (13.4s):

> Esta imagen es un documento legal que integra una tabla de gastos electorales, una captura de pantalla de redes sociales y una página web para demostrar la propiedad de activos digitales. La sección superior contiene una tabla de "Pólizas" que detalla montos, fechas de depósito y registro de julio de 2018, clasificando conceptos como "JORNADA ELECTORAL" y "CORRECCION" bajo el tipo de póliza "INGRESOS". El texto intermedio, identificado como el inciso b), establece que las páginas web www.fuerzaytrabajo.com y el perfil de Facebook "Fernando Tiscareño @fisca" tienen derechos reservados a favor de la organización "Chihuahua Participa, A.C.". La parte inferior muestra la cabecera del sitio web de la campaña política de "FERNANDO TISCAREÑO" con el lema sobre el gobierno con la gente. Este conjunto de evidencias se utiliza para validar la transparencia financiera y la titularidad de plataformas de comunicación durante el proceso electoral de 2018. Los términos clave para la búsqueda incluyen "Pólizas", "JORNADA ELECTORAL", "Chihuahua Participa, A.C.", "Fernando Tiscareño", "derechos reservados" y "gastos electorales".

**Claude 3 Haiku** (5.2s):

> TIPO: Tabla
IDENTIFICADORES LEGALES: Póliza, Ramo, Número de Póliza, Fecha de Inicio, Fecha de Vencimiento, Suma Asegurada, Prima Neta, Derechos, Impuestos, Total de Póliza
CONTENIDO LITERAL: Los valores numéricos, rangos, categorías, claves, abreviaturas y términos técnicos se muestran exactamente como aparecen en la tabla.
VOCABULARIO DE BÚSQUEDA: Póliza de seguro, ramo, suma asegurada, prima neta, derechos, impuestos, documentos legales, información de pólizas.

</details>

---

### Imagen 12 — Figura o logo pequeño

![Figura o logo pequeño](/images/posts/model-comparison/img12.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
> rogramas, procesos o acciones específicas, con el fin de obtener el diagnóstico de una situación, comparar las características de una población o para evaluar las variaciones en un evento.
> 
> Los indicadores permiten identificar las diferencias existentes entre los resultados planeados y obtenidos como base para la toma de decisiones, fijar el rumbo y alinear los esfuerzos hacia la consecución de las metas establecidas con el fin de lograr mejoras en los Programas.
> 
> **Los indicadores que deberán medirse son los siguientes:**
> 
> **a. Impacto de los spots en radio y televisión,** medido a través de los segundos que éstos estarán al aire; debiendo ser como mínimo \_\_\_\_\_\_\_\_\_segundos:
> 
> **b. I
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (2.5s):

> TIPO formula matematica para el calculo de indicadores estadisticos laborales. IDENTIFICADORES LEGALES normativa de transparencia y rendicion de cuentas sobre difusion de informacion oficial y cumplimiento de obligaciones patronales en materia de seguridad social o registros estatales. CONTENIDO LITERAL la expresion matematica consiste en el cociente del Numero de ejemplares impresos entre el Numero de trabajadores registrados en el Estado multiplicado por 100. VOCABULARIO DE BUSQUEDA indicadores de gestion publica, estadistica laboral, calculo de cobertura, transparencia gubernamental, registros de trabajadores, eficiencia administrativa, métricas de difusión oficial y cumplimiento normativo estatal. Esta formula permite determinar la proporcion de material impreso distribuido en relacion con la poblacion laboral formalmente inscrita ante las autoridades competentes. El calculo es fundamental para auditorias de impacto de programas sociales y verificacion de obligaciones de informacion publica en el ambito estatal.

**Gemini 2.5 Flash Lite** (1.2s):

> TIPO: Formula. IDENTIFICADORES LEGALES: No especificados en la imagen. CONTENIDO LITERAL: Numero de ejemplares impresos / Numero de trabajadores registrados en el Estado x 100. VOCABULARIO DE BUSQUEDA: Formula, calculo, proporcion, ejemplares impresos, numero de trabajadores, registro estatal, estadistica laboral, indice de impresion.

**GPT-5.4 Nano** (2.1s):

> TIPO: tabla o extracto de tabla con encabezados de variables. IDENTIFICADORES LEGALES: no se observan número de artículo, fracción, inciso, ley, reglamento, decreto, NOM ni referencia a DOF; la imagen muestra fórmulas o variables relacionadas con “Número de trabajadores registrados en el Estado”. CONTENIDO LITERAL: “Número de ejemplares impresos” y “Número de trabajadores registrados en el Estado × 100”. VOCABULARIO DE BUSQUEDA: términos para búsqueda de normativa y planeación/indicadores: “número de ejemplares impresos”, “número de trabajadores registrados en el Estado”, “porcentaje”, “fórmula”, “indicador”, “cálculo”.

**Qwen 3.6 Flash** (10.3s):

> La imagen muestra una fórmula matemática utilizada para el cálculo de un indicador porcentual o índice administrativo. El numerador de la fracción corresponde textualmente al "Número de ejemplares impresos", mientras que el denominador especifica el "Número de trabajadores registrados en el Estado". La operación establecida consiste en dividir el número de ejemplares impresos entre el número de trabajadores registrados y multiplicar el resultado por 100. Esta estructura se emplea comúnmente en normativas para determinar ratios de distribución o cumplimiento de cuotas en relación con la fuerza laboral estatal. Los términos de búsqueda relevantes incluyen la relación entre ejemplares impresos y trabajadores registrados, así como el cálculo de porcentajes basado en datos oficiales de empleo.

**Qwen 3.5 Flash** (8.5s):

> Esta imagen muestra una fórmula matemática diseñada para calcular una relación porcentual entre la producción de medios y la fuerza laboral. La ecuación divide el número de ejemplares impresos entre el número de trabajadores registrados en el Estado y multiplica el resultado por 100. Este cálculo es esencial para determinar la proporción de circulación de prensa escrita en función de la plantilla de empleados. Los términos técnicos presentes son ejemplares impresos, trabajadores registrados y el multiplicador x 100. La fórmula sirve como un indicador métrico para evaluar la estructura de las empresas periodísticas. Su aplicación es común en normativas que regulan el periodismo y la libertad de expresión. Este tipo de cálculo permite a los investigadores y abogados analizar la concentración de medios y la relación laboral en el sector.

**Claude 3 Haiku** (2.1s):

> TIPO: Tabla
IDENTIFICADORES LEGALES: Número de ejemplares impresos, Número de trabajadores registrados en el Estado
CONTENIDO LITERAL: Número de ejemplares impresos, x100, Número de trabajadores registrados en el Estado
VOCABULARIO DE BUSQUEDA: Estadísticas laborales, registro de trabajadores, impresión de documentos, datos gubernamentales

</details>

---

### Imagen 13 — Imagen de documento oficial

![Imagen de documento oficial](/images/posts/model-comparison/img13.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
> s instituciones de crédito presentarán sus posturas sin conocer las demás posturas presentadas o cualquier información relacionada. En este caso, la institución postora recibirá la información de las demás posturas hasta que el Banco de México dé a conocer a todas las instituciones de crédito postoras los resultados de la Subasta de Crédito en Dólares conforme a lo dispuesto en el numeral 8, o
> 
> > b\) Interactivas: aquellas en que las instituciones de crédito que presenten sus posturas puedan conocer la tasa marginal de asignación de la Subasta de Crédito en Dólares a partir del momento en que el monto total de las posturas presentadas por todas las instituciones de crédito postoras sea igual
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (2.0s):

> TIPO figura o notación matemática utilizada en fórmulas de cálculo de parámetros técnicos. IDENTIFICADORES LEGALES esta expresión corresponde a variables empleadas en metodologías de cálculo de Normas Oficiales Mexicanas NOM y reglamentos técnicos de infraestructura. CONTENIDO LITERAL la imagen muestra la notación j min i j que representa un índice o subíndice de variables en ecuaciones de ingeniería o normatividad técnica. VOCABULARIO DE BUSQUEDA términos como notación matemática, variables de cálculo, parámetros técnicos, especificaciones de ingeniería, fórmulas normativas y metodología de medición son fundamentales para la búsqueda de este contenido. Esta representación es común en documentos que establecen criterios de evaluación de la conformidad y estándares de calidad industrial en México. La notación permite identificar elementos específicos dentro de matrices o conjuntos de datos en reglamentos técnicos.

**Gemini 2.5 Flash Lite** (1.0s):

> TIPO: Figura.
IDENTIFICADORES LEGALES: No aplicable.
CONTENIDO LITERAL: j. ṁ ṅ.
VOCABULARIO DE BUSQUEDA: Derivada temporal, magnitud, vector, indice, notacion cientifica, fisica, ingenieria.

**GPT-5.4 Nano** (2.7s):

> TIPO: formula o expresión matemática. IDENTIFICADORES LEGALES: no se aprecian referencias legales explícitas como artículo, fracción, inciso, ley, reglamento, NOM, DOF o fecha. CONTENIDO LITERAL: “i_m^n”. VOCABULARIO DE BUSQUEDA: expresión matemática para modelado o variables con subíndices y superíndices, parámetros indexados, potencia o exponente n, índice m, notación i con subíndice y superíndice, términos para búsqueda en documentación técnica o científica donde se definan variables y relaciones entre i_m^n. También puede corresponder a identificación de una magnitud i dependiente de m y elevada a n, útil para recuperación de contenido técnico en contextos de ingeniería o matemáticas aplicadas.

**Qwen 3.6 Flash** (7.2s):

> La imagen muestra una notación matemática compuesta por la letra "j" como variable principal. Presenta un superíndice "min" que indica un valor mínimo o una condición de minimización aplicada a dicha variable. Adicionalmente, posee un subíndice "j" que funciona como un índice o identificador de la variable en un conjunto específico. Esta estructura es común en expresiones algebraicas, modelos de optimización o definiciones técnicas que requieren establecer límites inferiores. La representación simboliza el valor mínimo de la variable j indexada por j mismo. Los términos relevantes para la recuperación incluyen fórmula matemática, notación de índices, variable j, valor mínimo y expresión algebraica.

**Qwen 3.5 Flash** (19.8s):

> Esta imagen corresponde a una expresión matemática que representa una variable técnica con notación de subíndice y superíndice. El contenido literal visible es la letra i seguida de un subíndice j y un superíndice min. No se observan identificadores legales explícitos como números de artículo, leyes o decretos en la imagen. Este tipo de notación es común en fórmulas de cálculo, tablas de parámetros técnicos o anexos regulatorios que requieren precisión numérica. Los términos de búsqueda semántica deben incluir variable, índice, mínimo, subíndice, superíndice y notación matemática. Podría referirse a un valor mínimo asociado a un índice específico en contextos de ingeniería, economía o normativas técnicas. La descripción debe facilitar la recuperación de documentos que contengan fórmulas o variables similares.

**Claude 3 Haiku** (2.4s):

> TIPO: Tabla
IDENTIFICADORES LEGALES: Articulo 1, Fraccion I, Inciso a, Ley General de Salud
CONTENIDO LITERAL: Definiciones - Salud, Enfermedad, Promocion de la salud, Prevencion de enfermedades, Rehabilitacion, Asistencia social
VOCABULARIO DE BUSQUEDA: Definiciones legales, Ley General de Salud, Salud publica, Terminos medicos, Conceptos juridicos

</details>

---

### Imagen 19 — Figura o diagrama

![Figura o diagrama](/images/posts/model-comparison/img19.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
> |
> +-------------------------------------------------------------------------------------------------------------------+----------------------------------------------------------------------+
> | Nombre o Razón Social:                                                                                            | RFC                                                                  |
> |                                                                                                                   |                                                                      |
> |                                                                                                                   |              
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (2.6s):

> TIPO tabla de captura de datos estructurados para formularios oficiales. IDENTIFICADORES LEGALES formato de llenado para trámites administrativos ante dependencias federales conforme a la Ley Federal de Procedimiento Administrativo. CONTENIDO LITERAL doce casillas individuales dispuestas horizontalmente para el registro de caracteres alfanuméricos o códigos de identificación. VOCABULARIO DE BUSQUEDA campos de llenado, formato de solicitud, registro de datos, clave de identificación, folio administrativo, requisitos de forma, documentación oficial, llenado de formularios, estructura de datos, requerimientos de información. Esta estructura es utilizada frecuentemente en declaraciones, solicitudes de registro, cédulas de identificación fiscal o formularios de trámites gubernamentales en México. La disposición de las celdas permite la captura estandarizada de información necesaria para la validación de expedientes y el cumplimiento de obligaciones legales.

**Gemini 2.5 Flash Lite** (1.4s):

> TIPO: Tabla. IDENTIFICADORES LEGALES: No se infieren identificadores legales específicos de la imagen. CONTENIDO LITERAL: La imagen muestra una serie de celdas vacías dispuestas horizontalmente, separadas por líneas verticales. VOCABULARIO DE BUSQUEDA: Tabla, celdas, formato, estructura, datos, información, registro, formulario.

**GPT-5.4 Nano** (2.2s):

> TIPO: tabla. CONTENIDO LITERAL: una secuencia de celdas en cuadrícula sin texto visible, con un encabezado o margen superior no legible; no se distinguen identificadores legales, números de artículo, fracciones, incisos, ni nombres de ley, reglamento, decreto, NOM o DOF en la imagen. IDENTIFICADORES LEGALES: no identificables. VOCABULARIO DE BUSQUEDA: tabla de registro o plantilla tabular, celdas para capturar datos, estructura de formato para información normativa, validación de contenido documental, revisión de referencias legales faltantes. CONTENIDO LITERAL: únicamente aparece la cuadrícula/rejilla de celdas sin contenido textual legible.

**Qwen 3.6 Flash** (10.7s):

> Se trata de una tabla en blanco compuesta por una única fila con doce columnas vacías, diseñada para la captura de datos o registros administrativos. No contiene identificadores legales, artículos, fracciones ni referencias normativas visibles en su estructura actual. El contenido literal se limita a la disposición de la cuadrícula sin valores numéricos, categorías o términos técnicos específicos. Este formato es funcional para listar elementos, fechas o montos en un documento oficial. El vocabulario de búsqueda incluye términos como tabla, cuadrícula, campos de entrada, estructura de datos y registro vacío. Es un elemento gráfico neutro sin contenido semántico jurídico específico.

**Qwen 3.5 Flash** (9.5s):

> TIPO: Tabla o estructura de celdas. IDENTIFICADORES LEGALES: No se observan referencias legales, artículos, fracciones o normas oficiales en la imagen. CONTENIDO LITERAL: La imagen presenta una fila de celdas vacías sin texto, números o códigos legibles. VOCABULARIO DE BUSQUEDA: tabla, celdas, casillas, formulario, estructura, registro, campos, datos, casillero, columnas.

**Claude 3 Haiku** (2.0s):

> TIPO: Tabla
IDENTIFICADORES LEGALES: Articulo 1, Fraccion I, Inciso a, Ley General de Salud
CONTENIDO LITERAL: Consulta externa, Consulta de urgencias, Hospitalizacion, Cirugia, Rehabilitacion, Laboratorio, Imagenologia, Banco de sangre
VOCABULARIO DE BUSQUEDA: Servicios de salud, Atencion medica, Prestacion de servicios, Catalogo de servicios, Normativa sanitaria, Ley General de Salud

</details>

---

### Imagen 20 — Mapa geográfico de zona de veda (Sinaloa)

![Mapa geográfico de zona de veda (Sinaloa)](/images/posts/model-comparison/img20.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**User prompt:**

> Contexto del documento donde aparece esta imagen:
> """ 
> Ley General de Mejora Regulatoria y Quinto del "Acuerdo que fija los lineamientos que deberán ser observados por las dependencias y organismos descentralizados de la Administración Pública Federal, en cuanto a la emisión de los actos administrativos de carácter general a los que les resulta aplicable el artículo 69-H de la Ley Federal de Procedimiento Administrativo", publicado en el Diario Oficial de la Federación, el 8 de marzo de 2017, realizará las acciones de simplificación sobre el trámite indicado en el anexo correspondiente del AIR, en un plazo de seis meses contados a partir de la entrada en vigor de la presente Acuerdo.
> 
> Ciudad de México, a 22 de abril de 2020.- El Secretario de Ag
> """ 
> 
> Con base en este contexto y en la imagen, genera la descripcion para indexacion RAG.

</details>

<details>
<summary><strong>Ver respuestas de cada modelo</strong></summary>

**Gemini 3.1 Flash Lite** (2.5s):

> TIPO mapa de delimitación geográfica de zona de veda. IDENTIFICADORES LEGALES Acuerdo por el que se establece veda para la captura de almeja chocolata Megapitaria squalida en aguas de jurisdicción federal del estado de Sinaloa publicado en el Diario Oficial de la Federación DOF. CONTENIDO LITERAL El mapa delimita el Sistema Lagunar Altata-Ensenada del Pabellón en los municipios de Navolato y Culiacán Sinaloa con coordenadas geográficas entre 107.9 grados y 107.5 grados longitud oeste y 24.4 grados a 24.6 grados latitud norte. Se identifican los puntos de referencia A B C D E F G H I J K que definen el polígono de la zona de veda permanente para la especie Megapitaria squalida. VOCABULARIO DE BUSQUEDA Regulación pesquera veda permanente recursos marinos protección de especies acuáticas normativa ambiental mexicana ordenamiento pesquero zona de restricción de captura y biodiversidad marina. Este documento cartográfico es fundamental para la aplicación de sanciones administrativas y vigilancia por parte de la Comisión Nacional de Acuacultura y Pesca CONAPESCA.

**Gemini 2.5 Flash Lite** (1.7s):

> TIPO: Mapa. IDENTIFICADORES LEGALES: Sistema Lagunar Altata-Ensenada del Pabellón, Golfo de California, Sinaloa. CONTENIDO LITERAL: Zona de veda permanente para Almeja Chocolata (Megapitaria squalida), puntos de referencia A, B, C, D, E, F, G, H, I, J, K. VOCABULARIO DE BUSQUEDA: Mapa de veda, Almeja Chocolata, Megapitaria squalida, Sistema Lagunar Altata-Ensenada del Pabellón, Golfo de California, Sinaloa, acuacultura, pesca, regulación, zonas de reserva, coordenadas geográficas.

**GPT-5.4 Nano** (3.3s):

> TIPO: mapa geográfico. IDENTIFICADORES LEGALES: no se observan artículos, fracciones, incisos, leyes, reglamentos, decretos, NOM, DOF ni fechas; aparece “Sistema Lagunar Altata-Ensenada del Pabellón” y la ubicación “SINALOA”, además de “GOLFO DE CALIFORNIA” y la referencia de coordenadas “24.6°N”, “24.5°N”, “24.4°N”, “107.9°O”, “107.8°O”, “107.7°O”, “107.6°O”, “107.5°O”. CONTENIDO LITERAL: “Navolato”, “SINALOA”, “Culiacán”, “Golfo de California”, “Sistema Lagunar Altata-Ensenada del Pabellón”, “Zona de vida permanente”, “Amieq-Chocotala (Megapirania squadaula)”, “0 5 10 km”, y etiquetas de sectores “A”, “B”, “C”, “D”, “E”, “F”, “G”, “H”, “I”, “J”, “K”. VOCABULARIO DE BUSQUEDA: sistema lagunar, zona de vida permanente, Amieq-Chocotala, clasificación ecológica, parámetros geográficos por coordenadas, área de estudio, regionalización en Sinaloa, delimitación territorial de humedales costeros, inventario y planeación ambiental.

**Qwen 3.6 Flash** (9.7s):

> Mapa geográfico que muestra la zona costera del estado de Sinaloa en el Golfo de California, abarcando áreas cercanas a Navolato y Culiacán. La imagen destaca una zona de veda permanente marcada con sombreado diagonal, la cual se ubica principalmente en el Sistema Lagunar Altata-Ensenada del Pabellón. Esta restricción geográfica está destinada a la protección de la especie Almeja Chocolate, identificada científicamente como Megalipata aqualata. El mapa incluye coordenadas geográficas que van desde los 24.4°N hasta los 24.6°N de latitud y desde los 107.5°O hasta los 107.9°O de longitud, junto con una escala gráfica de 0 a 10 kilómetros. Este tipo de representación cartográfica es fundamental para la delimitación de áreas de protección ambiental y regulación de la pesca en normativas oficiales mexicanas.

**Qwen 3.5 Flash** (11.1s):

> Este mapa geográfico ilustra la ubicación del Sistema Lagunar Altata-Ensenada del Pabellón en el estado de Sinaloa, México, colindante con el Golfo de California. La imagen define una zona de veda permanente representada mediante un patrón de rayas diagonales que abarca desde el punto A hasta el punto J, incluyendo las localidades de Navolato y Culiacán. En la leyenda se especifica que esta restricción aplica para la especie Ameja Chocoala (Megapilota squalea), indicando una medida de protección ambiental. Las coordenadas geográficas del área se detallan en los ejes, variando entre los 24.4°N y 24.6°N de latitud y los 107.5°O y 107.9°O de longitud. Un cuadro de inserción muestra la posición relativa de esta zona dentro del territorio nacional. La escala gráfica permite medir distancias en kilómetros, con marcas de 0, 5 y 10 km. Este documento es relevante para la búsqueda de normativas sobre vedas de pesca, conservación de ecosistemas lagunares y regulaciones de la Secretaría de Medio Ambiente en la costa de Sinaloa.

**Claude 3 Haiku** (3.0s):

> TIPO: Mapa
IDENTIFICADORES LEGALES: Sistema Lagunar Altata-Ensenada del Pabellon
CONTENIDO LITERAL: Golfo de California, Sinaloa, Navolato, Culiacan
VOCABULARIO DE BUSQUEDA: mapa, sistema lagunar, zona de veda permanente, Altata-Ensenada del Pabellon, Sinaloa, geografia costera, recursos naturales, legislacion pesquera

</details>

---


## Resumen de velocidad

| Modelo | Tiempo promedio por imagen |
|--------|---------------------------|
| Gemini 2.5 Flash Lite | ~1.6s |
| GPT-5.4 Nano | ~2.7s |
| Gemini 3.1 Flash Lite | ~2.8s |
| Claude 3 Haiku | ~3.1s |
| Qwen 3.5 Flash | ~13.5s |
| Qwen 3.6 Flash | ~29s |

## Nuestras observaciones

**Gemini 2.5 Flash Lite** es el más rápido y consistente. Sigue bien las instrucciones, produce captions concisas y no alucina referencias legales. Ideal como opción por defecto.

**Gemini 3.1 Flash Lite** es el más detallado y verbaloso. El problema: tiende a alucinar referencias legales que no están en la imagen (por ejemplo, inventó "NOM-046-SCFI-1999" para un simple diagrama). Útil si quieres más contexto pero requiere validación.

**GPT-5.4 Nano** tiene buena extracción de contenido literal pero tiende a incluir descripciones visuales a pesar de la instrucción contraria. Se truncó en imágenes complejas por el límite de tokens.

**Qwen 3.5 y 3.6 Flash** son las más lentas (4-18x más que Gemini Flash Lite). Producen descripciones muy detalladas pero con mucha "paja" visual que no sirve para RAG. También tienden a incluir descripciones de colores y layout.

**Claude 3 Haiku** es el que mejor sigue instrucciones — las captions más limpias y sin descripciones visuales. Pero a veces es demasiado breve y omite contenido importante. También es 5x más caro que Gemini Flash Lite.

## Nuestra elección

Para un pipeline de 98,000 imágenes, **Gemini 2.5 Flash Lite** ofrece el mejor balance de velocidad, calidad, costo y seguimiento de instrucciones. No es perfecto, pero a ~$1.87 por todo el dataset, es difícil justificar algo más caro.

Si el presupuesto no fuera limitante, haríamos un enfoque de dos etapas: Gemini Flash Lite para la mayoría, y Claude Haiku para las imágenes donde Flash Lite produzca captions muy cortas o vacías.

¿Tú qué opinas? ¿Alguna experiencia similar con modelos de visión? 🙈

## Resumen de velocidad

| Modelo | Tiempo promedio por imagen |
|--------|---------------------------|
| Gemini 2.5 Flash Lite | ~1.6s |
| GPT-5.4 Nano | ~2.7s |
| Gemini 3.1 Flash Lite | ~2.8s |
| Claude 3 Haiku | ~3.1s |
| Qwen 3.5 Flash | ~13.5s |
| Qwen 3.6 Flash | ~29s |

## Nuestras observaciones

**Gemini 2.5 Flash Lite** es el más rápido y consistente. Sigue bien las instrucciones, produce captions concisas y no alucina referencias legales. Ideal como opción por defecto.

**Gemini 3.1 Flash Lite** es el más detallado y verbaloso. El problema: tiende a alucinar referencias legales que no están en la imagen (por ejemplo, inventó "NOM-046-SCFI-1999" para un simple diagrama). Útil si quieres más contexto pero requiere validación.

**GPT-5.4 Nano** tiene buena extracción de contenido literal pero tiende a incluir descripciones visuales a pesar de la instrucción contraria. Se truncó en imágenes complejas por el límite de tokens.

**Qwen 3.5 y 3.6 Flash** son las más lentas (4-18x más que Gemini Flash Lite). Producen descripciones muy detalladas pero con mucha "paja" visual que no sirve para RAG. También tienden a incluir descripciones de colores y layout.

**Claude 3 Haiku** es el que mejor sigue instrucciones — las captions más limpias y sin descripciones visuales. Pero a veces es demasiado breve y omite contenido importante. También es 5x más caro que Gemini Flash Lite.

## Nuestra elección

Para un pipeline de 98,000 imágenes, **Gemini 2.5 Flash Lite** ofrece el mejor balance de velocidad, calidad, costo y seguimiento de instrucciones. No es perfecto, pero a ~$1.87 por todo el dataset, es difícil justificar algo más caro.

Si el presupuesto no fuera limitante, haríamos un enfoque de dos etapas: Gemini Flash Lite para la mayoría, y Claude Haiku para las imágenes donde Flash Lite produzca captions muy cortas o vacías.

¿Tú qué opinas? ¿Alguna experiencia similar con modelos de visión? 🙈
