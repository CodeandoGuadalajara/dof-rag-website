---
title: "Iterando el prompt: segunda ronda de comparación de modelos VLM"
date: 2026-05-14
author: Equipo DOF-RAG
description: >-
  Segunda iteración del experimento: cambiamos el prompt, ajustamos las imágenes
  de prueba y reemplazamos Qwen por Grok y Gemma. Comparamos 6 modelos en 14
  imágenes del Diario Oficial de la Federación.
image: /images/posts/model-comparison/img21.png
tags:
  - DOF-RAG
  - IA
  - visión
  - modelos
  - comparación
  - OpenRouter
  - prompt
featured: false
---

# Iterando el prompt: segunda ronda de comparación de modelos VLM

En el [post anterior](/es/blog/2026/05/batalla-modelos-vlm/) comparamos 6 modelos VLM con un prompt que usaba etiquetas explícitas (TIPO:, IDENTIFICADORES LEGALES:, CONTENIDO LITERAL:, VOCABULARIO DE BÚSQUEDA:). Los resultados fueron útiles pero las respuestas tenían un formato repetitivo que no es ideal para búsqueda semántica.

Esta vez iteramos en tres frentes: el prompt, las imágenes de prueba y los modelos.

## ¿Qué cambió?

| Aspecto | v1 (post anterior) | v2 (este experimento) |
|---------|--------------------|-----------------------|
| Prompt | Etiquetas explícitas (TIPO:, CONTENIDO:) | Párrafo continuo, sin etiquetas |
| Imágenes | 15 (incluía logo, fórmulas pequeñas) | 14 (quitamos logo y fórmulas, agregamos organigrama y NOM) |
| Modelos | qwen3.6-flash, qwen3.5-flash-02-23 | grok-4.1-fast, gemma-4-31b-it |

### Cambios en imágenes

- **Eliminadas**: img04 (logo IFE redundante con img03), img09 y img10 (fórmulas matemáticas diminutas de baja resolución)
- **Agregadas**: img21 (organigrama de la Auditoría Superior de la Federación, 165KB) y img22 (diagrama técnico NOM-011-ENER-2024, 374KB)

### Cambios en modelos

Reemplazamos los modelos de Qwen porque en la v1 sus respuestas eran prácticamente idénticas entre sí y a las de Gemini, sin aportar diversidad. Probamos ahora con **Grok** (x-ai) y **Gemma** (Google) como opciones de proveedores diferentes.

## El prompt v2

> PROMPT NOT FOUND

Los cambios clave vs v1:
- **Sin etiquetas**: pedimos directamente un párrafo continuo de 4-6 oraciones
- **Uso del caption de la figura**: si el contexto incluye "FIGURA 1 Flexómetro", usar ese título como base
- **Inferencia explícita**: si la imagen es ambigua, inferir del contexto
- **Sin identificadores si no hay**: no forzar mencionar artículos si no aparecen
- **4-6 oraciones** (antes 4-8): más conciso

## Tiempos de respuesta

| Modelo | Tiempo promedio | Imágenes procesadas |
|--------|----------------|---------------------|
| gemini-2.5-flash-lite | 2.1s | 14/14 |
| gemini-3.1-flash-lite | 2.8s | 14/14 |
| gpt-5.4-nano | 3.7s | 14/14 |
| claude-3-haiku | 3.7s | 14/14 |
| gemma-4-31b-it | 11.4s | 14/14 |
| grok-4.1-fast | 15.7s | 14/14 |

0 errores en 84 llamadas (14 imágenes × 6 modelos). Gemini 2.5 Flash Lite sigue siendo el más rápido, Grok el más lento por bastante margen.

## Los resultados — imagen por imagen

### img01.png — Diagrama técnico de componentes mecánicos (cinta métrica)

![Diagrama técnico de componentes mecánicos (cinta métrica)](/images/posts/model-comparison/img01.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

> lece en 7.1.
> 
> **5.2** Exactitud de la cinta
> 
> Las líneas que indiquen las divisiones de la cinta deben ser como máximo de 0,40 mm de ancho, perpendiculares al eje longitudinal de la cinta, ser claras, exactas y resistentes al uso. La longitud de las líneas deben ser variables en razón directa del valor mayor que limitan las unidades con números de orden indicados con caracteres arábigos, por lo menos para los decímetros y unidades mayores. Las cintas tipo 1 deben subdividirse en milímetros en toda su extensión; las cintas tipo 2, deben subdividirse por lo menos en decímetros y el primer decímet

</details>

<details>
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (6.3s):

Esta imagen consiste en un diagrama técnico que ilustra la configuración física de una cinta métrica, conforme a las especificaciones de exactitud y diseño establecidas en el apartado 5.2 del documento normativo. El esquema representa dos vistas de un instrumento de medición de longitud, detallando la estructura de la cinta enrollada y el mecanismo de sujeción o carcasa. Este contenido es fundamental para la interpretación de las normas técnicas sobre instrumentos de medición, específicamente en...


**gemini-2.5-flash-lite** (1.6s):

Este es un diagrama que ilustra las especificaciones técnicas de una cinta métrica, detallando la exactitud y las divisiones de la cinta. Se describen las características de las líneas de medición, como su ancho máximo de 0.40 mm y su perpendicularidad al eje longitudinal. Se especifican las subdivisiones de las cintas tipo 1 y tipo 2, indicando que las cintas tipo 1 deben subdividirse en milímetros en toda su extensión, mientras que las cintas tipo 2 deben subdividirse al menos en decímetros, c...


**gpt-5.4-nano** (5.1s):

La imagen corresponde a un diagrama esquemático de cintas de medición donde se señalan las partes relevantes para evaluar exactitud, en particular la traza y las líneas que indican las divisiones de la cinta, con énfasis en su forma y posición respecto al eje longitudinal. En el contexto del documento, el contenido técnico se refiere a que las líneas divisorias deben ser como máximo de 0,40 mm de ancho, perpendiculares al eje longitudinal, claras, exactas y resistentes al uso, y que su longitud ...


**grok-4.1-fast** (12.5s):

Diagrama esquemático que ilustra la estructura de una cinta métrica desenrollada desde su rollo con flecha indicadora y un sello rectangular de verificación con muesca y protuberancia. Representa las divisiones de la cinta conforme a la sección 5.2 Exactitud de la cinta, donde las líneas deben tener un máximo de 0,40 mm de ancho, ser perpendiculares al eje longitudinal, claras, exactas y resistentes al uso. Muestra subdivisiones en milímetros para cintas tipo 1 en toda su extensión y para tipo 2...


**gemma-4-31b-it** (7.4s):

Esta imagen es un diagrama técnico que representa un flexómetro o cinta métrica. El contenido se relaciona con las especificaciones de exactitud de la cinta detalladas en el apartado 5.2 del documento. El esquema muestra la estructura del dispositivo de medición, incluyendo el carrete y la cinta extensible. Los términos técnicos relevantes para la búsqueda incluyen cintas tipo 1, cintas tipo 2, subdivisiones en milímetros y decímetros, y tolerancias de longitud. Este diagrama sirve como referenc...


**claude-3-haiku** (3.5s):

La imagen muestra un diagrama que representa una cinta métrica o flexómetro. Según el contexto del documento, esta imagen se relaciona con la Norma Oficial Mexicana NOM-EE-001-SCFI-2017, que establece los requisitos y especificaciones técnicas que deben cumplir las cintas métricas o flexómetros utilizados en México. El diagrama ilustra los requisitos de exactitud de las líneas que indican las divisiones de la cinta, como el ancho máximo de 0.40 mm, la perpendicularidad al eje longitudinal y la c...


</details>

---


### img02.png — Diagrama técnico de componente mecánico

![Diagrama técnico de componente mecánico](/images/posts/model-comparison/img02.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

> erpendiculares al eje longitudinal de la cinta, ser claras, exactas y resistentes al uso. La longitud de las líneas deben ser variables en razón directa del valor mayor que limitan las unidades con números de orden indicados con caracteres arábigos, por lo menos para los decímetros y unidades mayores. Las cintas tipo 1 deben subdividirse en milímetros en toda su extensión; las cintas tipo 2, deben subdividirse por lo menos en decímetros y el primer decímetro subdividido en milímetros, tanto las tolerancias de longitud como la carga a que debe sujetarse la cinta para medir su exactitud se indic

</details>

<details>
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (2.1s):

Esta imagen corresponde a un diagrama técnico que ilustra un flexómetro con cinta métrica, conforme a lo establecido en la normativa técnica sobre instrumentos de medición. La figura representa esquemáticamente el mecanismo de enrollado y la estructura física del dispositivo utilizado para mediciones de longitud. El contenido gráfico sirve como referencia visual para la clasificación de cintas métricas tipo 1 y tipo 2, las cuales deben cumplir con especificaciones de subdivisión en milímetros y ...


**gemini-2.5-flash-lite** (1.3s):

La figura 1 muestra un flexómetro con cinta métrica, un instrumento de medición esencial para la verificación de la exactitud de las cintas métricas. El flexómetro, también conocido como cinta métrica retráctil, se utiliza para medir longitudes y se caracteriza por tener líneas claras, exactas y resistentes al uso, dispuestas perpendicularmente al eje longitudinal de la cinta. Las subdivisiones de la cinta, ya sean en milímetros para cintas tipo 1 o en decímetros y milímetros para cintas tipo 2,...


**gpt-5.4-nano** (5.9s):

La imagen corresponde a una figura técnica, tipo diagrama/representación esquemática, rotulada como FIGURA 1 Flexómetro con cinta métrica, utilizada para ilustrar las partes y el funcionamiento del flexómetro con cinta métrica. En el contexto del documento se describe la necesidad de que las líneas o marcas sean claras, exactas y resistentes al uso, y que su longitud sea variable en razón directa del valor mayor que limitan, con unidades que deben llevar números de orden con caracteres arábigos ...


**grok-4.1-fast** (7.4s):

Diagrama esquemático de la FIGURA 1 Flexómetro con cinta métrica, que ilustra la estructura de una cinta métrica enrollada en un casing circular con mango y gancho terminal, junto a una vista desplegada mostrando subdivisiones lineales. Representa cintas tipo 1 subdivididas en milímetros en toda su extensión y cintas tipo 2 subdivididas al menos en decímetros con el primer decímetro en milímetros, con líneas perpendiculares al eje longitudinal claras y exactas marcadas con números arábigos para ...


**gemma-4-31b-it** (16.7s):

Esta imagen es un diagrama técnico que representa un flexómetro con cinta métrica. De acuerdo con la Figura 1 del documento, el esquema muestra la vista frontal y lateral de un dispositivo de medición lineal. El contenido se relaciona con las especificaciones técnicas de cintas tipo 1 y tipo 2, enfocándose en la subdivisión de milímetros y decímetros. Este recurso es fundamental para el cumplimiento de las tolerancias de longitud y la carga de exactitud mencionadas en la tabla 1 y el apartado 7....


**claude-3-haiku** (3.5s):

La imagen muestra un diagrama de un flexómetro con cinta métrica. Según el contexto, esta figura se titula "FIGURA 1 Flexómetro con cinta métrica" y forma parte de una norma oficial mexicana que establece los requisitos para las cintas métricas, incluyendo las tolerancias de longitud y la carga a la que deben someterse para comprobar su exactitud. El diagrama ilustra las características de las líneas perpendiculares al eje longitudinal de la cinta, que deben ser claras, exactas y resistentes al ...


</details>

---


### img03.png — Logotipo del Instituto Federal Electoral (IFE)

![Logotipo del Instituto Federal Electoral (IFE)](/images/posts/model-comparison/img03.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

> l 25 de mayo de 1999, de manera que el Instituto Federal Electoral esté en aptitud de suscribir convenios de apoyo y colaboración directamente con las Agrupaciones Políticas Nacionales. En todo caso, dichos convenios tendrán que ser aprobados con anterioridad por la Comisión de Capacitación Electoral y Educación Cívica.
> 
> **CUARTO.-** Notifíquese por oficio el presente Acuerdo a las Agrupaciones Políticas Nacionales.
> 
> **QUINTO.-** Publíquese el presente Acuerdo en el **Diario Oficial de la Federación**.
> 
> El presente acuerdo fue aprobado en sesión extraordinaria del Consejo General celebrada el 

</details>

<details>
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (4.1s):

Esta imagen corresponde al logotipo institucional del Instituto Federal Electoral, identificado comúnmente por sus siglas IFE. El emblema representa la autoridad administrativa encargada de la organización de los procesos electorales federales en México, conforme a las facultades otorgadas por la legislación electoral vigente en el periodo de su emisión. Este distintivo aparece en documentos oficiales, acuerdos del Consejo General y convenios de colaboración suscritos por el organismo. La presen...


**gemini-2.5-flash-lite** (1.7s):

Este es un logotipo del Instituto Federal Electoral (IFE). El logotipo muestra un rombo naranja sobre una línea horizontal gris, seguido de las letras "IFE" en mayúsculas negras. Debajo de las letras, se lee el nombre completo "INSTITUTO FEDERAL ELECTORAL" en mayúsculas. Este logotipo se asocia con la institución encargada de organizar las elecciones federales en México, y su aparición en el Diario Oficial de la Federación indica la publicación de acuerdos o normativas relacionadas con su funcio...


**gpt-5.4-nano** (3.7s):

La imagen corresponde a un logotipo institucional del Instituto Federal Electoral (IFE), con la leyenda IFE e Instituto Federal Electoral. En el contexto del documento, el logotipo se utiliza para identificar la autoridad responsable que emite y suscribe un acuerdo publicado en el Diario Oficial de la Federación, relacionado con la aptitud para suscribir convenios de apoyo y colaboración con Agrupaciones Políticas Nacionales, sujetándolo a aprobación previa por la Comisión de Capacitación Electo...


**grok-4.1-fast** (11.1s):

Logotipo oficial del Instituto Federal Electoral (IFE) que muestra el acrónimo IFE junto al nombre completo INSTITUTO FEDERAL ELECTORAL. Se integra en el contexto de un Acuerdo del Consejo General del IFE aprobado en sesión extraordinaria el 16 de diciembre de 2004 y publicado en el Diario Oficial de la Federación. El acuerdo regula la suscripción de convenios de apoyo y colaboración con Agrupaciones Políticas Nacionales, aprobados previamente por la Comisión de Capacitación Electoral y Educació...


**gemma-4-31b-it** (6.0s):

Esta imagen es un logotipo institucional del Instituto Federal Electoral. El contenido literal muestra las siglas IFE y el nombre completo Instituto Federal Electoral. El elemento gráfico se vincula con un Acuerdo aprobado en sesión extraordinaria del Consejo General el 16 de diciembre de 2004 y publicado en el Diario Oficial de la Federación. Esta imagen es relevante para búsquedas relacionadas con la autoridad electoral mexicana, convenios con Agrupaciones Políticas Nacionales y la gestión de ...


**claude-3-haiku** (2.7s):

La imagen muestra el logotipo del Instituto Federal Electoral (IFE) de México. El logotipo consiste en un triángulo amarillo con el texto "IFE" en letras negras. Este logotipo es utilizado por el organismo electoral federal mexicano, responsable de organizar y supervisar los procesos electorales en el país. El contexto del documento indica que este acuerdo del Consejo General del IFE se publicó en el Diario Oficial de la Federación, la gaceta oficial del gobierno mexicano. Un investigador o func...


</details>

---


### img05.png — Gráfica de barras comparativa (mercado interno)

![Gráfica de barras comparativa (mercado interno)](/images/posts/model-comparison/img05.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

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
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (1.9s):

Esta imagen consiste en dos gráficas de barras comparativas que ilustran la relación entre el mercado interno, la producción y las exportaciones de China. El contenido visual presenta categorías específicas etiquetadas como Consumo interno, Producción y Exportaciones de China, destacando un volumen significativamente mayor en el rubro de exportaciones. Este material gráfico se integra en el análisis de mercado y comercio exterior relacionado con la regulación de calefactores de ambiente bajo la ...


**gemini-2.5-flash-lite** (1.5s):

Este es un diagrama de barras que compara el consumo interno, la producción y las exportaciones de China dentro del mercado interno. Se presentan dos gráficos idénticos, cada uno mostrando tres barras que representan estas categorías. Las barras de "Consumo interno" y "Producción" son significativamente más bajas que la barra de "Exportaciones de China", lo que indica una diferencia sustancial en estas métricas. La línea vertical azul en cada gráfico podría representar un punto de referencia o u...


**gpt-5.4-nano** (2.9s):

La imagen corresponde a una gráfica comparativa de barras sobre mercado interno y exportaciones, con dos paneles que muestran el mismo esquema. En ambos paneles aparece Mercado interno en el eje superior y, en la base, las categorías Consumo interno, Producción y Exportaciones de China, además de una barra destacada para el mercado interno. Al ubicarse en el contexto del capítulo 7.2.6.2 Del recipiente portátil y la subsección 7.3 sobre estabilidad del aparato, la gráfica parece utilizada para a...


**grok-4.1-fast** (14.9s):

Gráficas de barras horizontales idénticas en dos paneles que representan la distribución del mercado interno, con ejes categorizados en Consumo interno, Producción y Exportaciones de China. En cada gráfica, el Consumo interno muestra una barra azul baja, la Producción una barra azul mínima casi nula y las Exportaciones de China una barra azul alta dominante que ocupa la mayor parte del espacio visual. Ilustran la preponderancia de las exportaciones hacia China sobre el consumo y producción local...


**gemma-4-31b-it** (12.8s):

Esta imagen consiste en dos gráficas de barras comparativas que analizan el mercado interno. El contenido literal muestra categorías de Consumo interno, Producción y Exportaciones de China. Las gráficas representan visualmente la disparidad entre el consumo y la producción nacional frente al volumen de las exportaciones provenientes de China. Aunque el contexto textual menciona la figura 1 relacionada con una cuña de madera para pruebas de estabilidad, la imagen muestra datos comerciales. Un inv...


**claude-3-haiku** (3.8s):

La imagen muestra dos gráficos de barras que comparan el mercado interno y la producción de China en términos de consumo interno, producción y exportaciones de China. Los gráficos no contienen identificadores legales específicos, pero el contexto del documento indica que se trata de una norma oficial mexicana (NOM) relacionada con calefactores de ambiente. Los términos clave que un abogado, funcionario o investigador utilizaría para buscar este contenido serían: mercado interno, producción, expo...


</details>

---


### img06.png — Formato de certificación de gasto (Caravanas de la Salud)

![Formato de certificación de gasto (Caravanas de la Salud)](/images/posts/model-comparison/img06.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

> valor total de la producción de las empresas beneficiarias del cupo en los tres años calendario anteriores al inicial del periodo de vigencia del cupo para el cual solicita asignación, ponderada por 0.35; más
> 
> > c. La participación del valor de las inversiones en activos fijos realizadas en México por cada empresa, en el valor total de las inversiones de las empresas beneficiarias del cupo en los tres años calendario anteriores al inicial del periodo de vigencia del cupo para el cual solicita asignación, ponderado por 0.20.
> 
> > Todo lo anterior multiplicado por el monto del cupo total del perio

</details>

<details>
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (2.7s):

Este documento es un formato administrativo oficial denominado Formato de Certificación de Gasto para Gastos de Operación, correspondiente al Anexo 4 del Programa Caravanas de la Salud de la Dirección General de Planeación y Desarrollo en Salud de la Secretaría de Salud para el ejercicio 2014. El formulario incluye campos específicos para la comprobación de recursos públicos como entidad federativa, concepto de gasto, monto, partida específica, número de factura pagada, póliza cheque, modalidad ...


**gemini-2.5-flash-lite** (2.1s):

Este es un formato administrativo de la Dirección General de Planeación y Desarrollo en Salud, correspondiente al Programa Caravanas de la Salud, Ejercicio 2014. El documento se titula "Formato de Certificación de Gasto para 'Gastos de Operación'" y se identifica como Anexo 4. Incluye campos para la Entidad Federativa, Concepto de Gasto de Aplicación, Nombre del Concepto de Gasto, Monto por concepto de gasto, y Fecha de elaboración. La tabla principal detalla Partida Específica, Número Factura P...


**gpt-5.4-nano** (3.1s):

La imagen es un formato administrativo de certificación de gasto denominado Formato de Certificación de Gasto para “GASTOS DE OPERACIÓN”, identificado como ANEXO 4 del Programa de Carrera de la Salud EJCERCICIO 2014, correspondiente a la Dirección General de Planeación y Desarrollo en Salud, Secretaría de Salud. Incluye campos para la Entidad Federativa, el Monto por concepto de gasto, el Concepto de Gasto de Aplicación y la Fecha de elaboración, además de una sección de captura de datos de comp...


**grok-4.1-fast** (24.3s):

Formato administrativo de certificación de gastos de operación identificado como ANEXO 4 de la Dirección General de Planeación y Desarrollo en Salud de la Secretaría de Salud, con campos numerados para registro detallado de comprobantes fiscales y administrativos. Incluye secciones para Entidad Federativa, monto de gasto, concepto de gasto o aplicación, nombre del concepto de gasto, fecha de elaboración, y una tabla con columnas como Número Factura Pagada, Póliza Cheque, Fecha P/Chque, Mod Adqui...


**gemma-4-31b-it** (10.6s):

Este formato administrativo corresponde al Anexo 4 denominado Formato de Certificación de Gasto para Gastos de Operación del Programa Caravanas de la Salud para el ejercicio 2014 de la Secretaría de Salud. El documento incluye campos para capturar la Entidad Federativa, el Monto por concepto de gasto, el Concepto de Gasto de Aplicación, el Nombre del Concepto de Gasto y la Fecha de elaboración. Contiene una tabla detallada con columnas para Partida Específica, Número Factura Pagada, Póliza Chequ...


**claude-3-haiku** (5.4s):

Esta imagen representa un formato de certificación de gasto para "Gastos de Operación" del Programa Caravanas de la Salud, ejercicio 2014, emitido por la Dirección General de Planeación y Desarrollo en Salud de la Secretaría de Salud. 

El formato incluye campos para registrar la Entidad Federativa, el Concepto de Gasto de Aplicación, la Fecha de Elaboración, así como diversos detalles de la operación como Partida Específica, Número de Factura Pagada, Póliza de Cheque, Fecha de Póliza-Cheque, Mo...


</details>

---


### img07.png — Tablas de la Comisión Nacional de Hidrocarburos (CNH)

![Tablas de la Comisión Nacional de Hidrocarburos (CNH)](/images/posts/model-comparison/img07.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

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
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (2.7s):

Este documento presenta tres formatos administrativos oficiales de la Comisión Nacional de Hidrocarburos identificados como parte 16 de 18 Actividad e Inversión, parte 17 de 18 Evaluación y parte 18 de 18 Máxima RGA. El primer formato es una tabla para el desglose de inversión en millones de pesos que incluye columnas para instalación, concepto u obra, costo total, ejercicio al año 20XX, desglose mensual de enero a diciembre, programado 20XX y programado a ejercer 20XX. El segundo formato es una...


**gemini-2.5-flash-lite** (2.8s):

Esta imagen contiene tres tablas de la Comisión Nacional de Hidrocarburos (CNH) publicadas en el Diario Oficial de la Federación (DOF). La primera tabla, titulada "Parte 16 de 18 Actividad e Inversión", detalla el costo total, ejercicio al año 20XX y monto de inversión por mes y programado para la instalación y concepto/obra. La segunda tabla, "Parte 17 de 18 Evaluación", presenta el promedio anual (MMPCD), volumen anual (MMPC), valor del gas (ingreso en MMPesos), gasto de operación (MMPesos) y ...


**gpt-5.4-nano** (3.6s):

La imagen corresponde a un formato administrativo del gob.mx para la Comisión Nacional de Hidrocarburos, con secciones tituladas Parte 16 de 18 Actividad e Inversión, Parte 17 de 18 Evaluación y Parte 18 de 18 Máxima RGA. En la Parte 16 se muestra una tabla de Instalación con Concepto/Etapa, Capacidad Total (Millones de Pies Cúbicos de Gas al Día o Millones de pesos), Ejercicios 2020 y meses Enero a Diciembre, y una columna de Monto de Inversión (Millones de Pesos) con campos Programado 2020 (Mi...


**grok-4.1-fast** (17.8s):

Conjunto de tablas del Formato PAGNA de la Comisión Nacional de Hidrocarburos correspondientes a las partes 16 de 18 Actividad e Inversión, 17 de 18 Evaluación y 18 de 18 Máxima RGA, con encabezados como Instalación Concepto DOB Efectivo al 31 de dic, meses de enero a diciembre, Prog 2020 y Millones de Pesos para inversiones totales reportadas en ceros. Incluye tabla de Valor del Gas MMPCD y Gastos de Operación MMPEsos por años 1 al 18 con totales en ceros, así como tabla de Formación con column...


**gemma-4-31b-it** (8.8s):

Esta imagen contiene tres formatos administrativos de la Comisión Nacional de Hidrocarburos relacionados con la gestión de proyectos. El primer formato es una tabla de Actividad e Inversión que detalla costos totales, montos de inversión mensuales en millones de pesos y programación para el año 20XX. El segundo formato es una tabla de Evaluación con columnas anuales numeradas del 1 al 18 que registra el promedio anual MMPCD, volumen anual MMPC, valor del gas, gasto de operación y servicio de com...


**claude-3-haiku** (4.7s):

La imagen muestra una tabla que contiene información sobre la Actividad e Inversión (Parte 16 de 18) y la Evaluación (Parte 17 de 18) de la Comisión Nacional de Hidrocarburos. Incluye datos como Instalación, Concepto/Obra, Costo Total, Ejercicio de Gasto, Avance Físico, Monto de Inversión, Programación Anual 2020, entre otros. También se presenta una sección sobre la Máxima RGA (Parte 18 de 18) con campos para Formación, Actual y Máxima. Este tipo de información sería relevante para abogados, fu...


</details>

---


### img08.png — Documento oficial con encabezado (INE)

![Documento oficial con encabezado (INE)](/images/posts/model-comparison/img08.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

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
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (2.9s):

Esta imagen corresponde a la portada de un documento administrativo oficial emitido por el Instituto Nacional Electoral identificado como Plan de Seguridad para el Modelo de Operación de la casilla con Urna Electrónica. El documento establece los lineamientos técnicos y operativos para los Procesos Electorales Locales 2019-2020 realizados en las entidades federativas de Coahuila y Hidalgo. La publicación está fechada en febrero de 2020 y constituye un instrumento normativo fundamental para la im...


**gemini-2.5-flash-lite** (2.2s):

Este documento es un plan de seguridad del Instituto Nacional Electoral (INE) para el modelo de operación de la casilla con urna electrónica en los procesos electorales locales de Coahuila e Hidalgo de 2019-2020. La fecha de publicación es febrero de 2020. El documento se relaciona con la regulación electoral y la implementación de tecnología en los comicios. Los términos de búsqueda relevantes incluyen "INE", "Procesos Electorales Locales", "Urna Electrónica", "Coahuila", "Hidalgo", "Plan de Se...


**gpt-5.4-nano** (5.6s):

La imagen muestra un formato institucional de tipo carátula/documento del Instituto Nacional Electoral, correspondiente a un Plan de Seguridad para el Modelo de Operación de la casilla con Urna Electrónica para los Procesos Electorales Locales 2019-2020 en Coahuila e Hidalgo. En el documento se identifica explícitamente la dependencia como INE (Instituto Nacional Electoral) y se incluye la denominación del plan y el alcance territorial y de proceso electoral local. Asimismo, aparece la fecha de ...


**grok-4.1-fast** (19.2s):

Formato administrativo de portada oficial del Instituto Nacional Electoral (INE) que presenta el Plan de Seguridad para la operación de la casilla con urna electrónica en el modelo de Procesos Electorales Locales 2019-2020 en Coahuila, fechado en febrero 2020. Incluye el logotipo del INE y su denominación completa como Instituto Nacional Electoral. Se infiere su aparición en un Acuerdo derogado de la Comisión Nacional de Hidrocarburos publicado en el Diario Oficial de la Federación, con fecha de...


**gemma-4-31b-it** (9.2s):

Esta imagen es un logotipo y portada de un documento administrativo perteneciente al Instituto Nacional Electoral INE. El contenido literal indica que se trata del Plan de Seguridad para el Modelo de Operación de la casilla con Urna Electrónica para los Procesos Electorales Locales 2019-2020 en Coahuila e Hidalgo. El documento tiene como fecha de emisión febrero 2020. Un investigador o funcionario buscaría este contenido mediante términos como seguridad electoral, urnas electrónicas, procesos el...


**claude-3-haiku** (3.0s):

Esta imagen corresponde a un plan de seguridad para el modelo de operación de la casilla con urna electrónica para los Procesos Electorales Locales 2019-2020 en Coahuila e Hidalgo, publicado por el Instituto Nacional Electoral (INE) en febrero de 2020. El documento contiene información sobre los lineamientos y procedimientos a seguir para garantizar la seguridad y el adecuado funcionamiento de las casillas electorales con urna electrónica en dichos estados. Términos clave que un abogado, funcion...


</details>

---


### img11.png — Captura de sistema contable electoral (pólizas)

![Captura de sistema contable electoral (pólizas)](/images/posts/model-comparison/img11.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

> la alta dirección capacitados de la Entidad Federativa sobre el nuevo Sistema de Justicia Laboral previo al 1° de octubre de 2020.
> 
> > **2. Indicadores:** Los indicadores son útiles para poder medir con claridad los resultados obtenidos con la aplicación de programas, procesos o acciones específicos, con el fin de obtener el diagnóstico de una situación, comparar las características de una población o para evaluar las variaciones de un evento.
> 
> > Permite identificar las diferencias existentes entre los resultados planeados y obtenidos como base para la toma de decisiones, fijar el rumbo y aline

</details>

<details>
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (3.6s):

Esta imagen presenta un formato administrativo de consulta de pólizas contables y capturas de pantalla de redes sociales y sitios web utilizados como evidencia en una investigación electoral. La tabla de pólizas detalla registros financieros del sujeto obligado Local Presidente Municipal Chihuahua Chihuahua, incluyendo columnas como número de póliza, periodo de operación, tipo de póliza, fecha de operación, descripción y montos de cargo y abono. Las capturas de pantalla corresponden a la página ...


**gemini-2.5-flash-lite** (3.4s):

Esta imagen contiene una tabla de pólizas con información detallada sobre registros, fechas de operación y montos, así como capturas de pantalla de páginas web y perfiles de redes sociales. Los identificadores legales que se infieren del contexto son relacionados con la "Entidad Federativa" y la posible aplicación de "programas, procesos o acciones específicos". Los términos de búsqueda relevantes incluyen "tabla de pólizas", "registros", "fechas de operación", "montos", "páginas web", "redes so...


**gpt-5.4-nano** (3.9s):

La imagen es una captura de pantalla y páginas de verificación en formato administrativo tipo interfaz web que muestran el sistema de consulta de un listado de pólizas, con columnas como Id, Vía de autoridad, Tipo de corrección, Ingresos, Total de pólizas, y referencias de registro como “OFICIO” y estados del proceso, además de controles para consulta/modificación y paginación. En la captura se aprecia el texto de evidencia documental donde se indica que las páginas www.fuerzatrabajo.com y “Fern...


**grok-4.1-fast** (20.6s):

Imagen compuesta por una tabla de pólizas electorales y capturas de pantalla de páginas web relacionadas con campañas políticas en Chihuahua. La tabla detalla filtros de pólizas en Zona Centro de la Junta Local de Conciliación y Arbitraje, con períodos como 01-07-2018 al 15-07-2018 17:49, tipos Normal, Corrección e Ingreso, totales en pesos como 24.956.30 MXN, 29.869.70 MXN, 147.951.16 MXN y 131.386 MXN para registros como REGISTRO COM., PROPIETARIO D.G. y REGISTRO INGRE. Incluye descripciones d...


**gemma-4-31b-it** (9.9s):

Esta imagen es un conjunto de capturas de pantalla que funcionan como evidencia documental en un formato administrativo. El contenido muestra perfiles de redes sociales en Facebook pertenecientes a fuerzatrabajo.com y Fernando Tiscareño @ftisca, así como una página web institucional. Se menciona explícitamente que los derechos reservados de ambas páginas se encuentran a favor de Chihuahua Participa, A.C. Los términos clave incluyen la transferencia de derechos de propiedad digital, evidencia de ...


**claude-3-haiku** (4.7s):

La imagen muestra una tabla con información sobre pólizas de seguros, incluyendo datos como número de póliza, tipo de cobertura, fecha de inicio y fin, monto asegurado y prima. Algunos de los identificadores legales presentes son el número de registro de la póliza, la fecha de emisión y la denominación de la compañía aseguradora. Esta información sería relevante para un abogado, funcionario o investigador que necesite consultar los detalles de las pólizas de seguros contratadas por una entidad. ...


</details>

---


### img12.png — Fórmula matemática (indicador estadístico)

![Fórmula matemática (indicador estadístico)](/images/posts/model-comparison/img12.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

> rogramas, procesos o acciones específicas, con el fin de obtener el diagnóstico de una situación, comparar las características de una población o para evaluar las variaciones en un evento.
> 
> Los indicadores permiten identificar las diferencias existentes entre los resultados planeados y obtenidos como base para la toma de decisiones, fijar el rumbo y alinear los esfuerzos hacia la consecución de las metas establecidas con el fin de lograr mejoras en los Programas.
> 
> **Los indicadores que deberán medirse son los siguientes:**
> 
> **a. Impacto de los spots en radio y televisión,** medido a través de 

</details>

<details>
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (2.3s):

Esta imagen presenta una fórmula matemática utilizada como indicador de gestión o evaluación de programas públicos. La expresión algebraica calcula un porcentaje mediante la división del número de ejemplares impresos entre el número de trabajadores registrados en el Estado, multiplicando el resultado por cien. Este indicador es fundamental para medir el alcance, la cobertura o la distribución de materiales informativos en relación con la población laboral activa. Los términos clave para la búsqu...


**gemini-2.5-flash-lite** (1.6s):

Esta imagen presenta una fórmula matemática que representa un indicador. La fórmula se define como el "Número de ejemplares impresos" dividido por el "Número de trabajadores registrados en el Estado", multiplicado por 100. Este tipo de cálculo se utiliza comúnmente en análisis estadísticos y de gestión para medir la proporción o el alcance de ciertos materiales impresos en relación con la fuerza laboral de una entidad. Los términos clave para la búsqueda incluyen "indicador", "fórmula", "ejempla...


**gpt-5.4-nano** (1.9s):

La imagen corresponde a un formato tipo tabla o renglón de criterios de medición de indicadores, en el que se presenta una variable con la redacción Número de empleares impresos y su equivalente en unidades del Estado. Aparece el texto Número de trabajadores registrados en el Estado x 100, lo que indica una fórmula o cálculo para determinar un porcentaje relativo al número de trabajadores registrados. El documento, en el contexto de la medición de indicadores para Programas, usa este indicador p...


**grok-4.1-fast** (21.4s):

Esta imagen representa una fórmula matemática para el cálculo de un indicador cuantitativo en el contexto de programas y procesos evaluados mediante indicadores de impacto. La ecuación establece el cociente entre el número de ejemplares impresos multiplicado por 100 y el número de trabajadores registrados en el Estado, expresada como \frac{Número de ejemplares impresos \times 100}{Número de trabajadores registrados en el Estado}. Este indicador se relaciona con la medición de resultados en accio...


**gemma-4-31b-it** (9.1s):

Esta imagen es una fórmula matemática que representa un indicador de medición administrativa. El contenido literal de la operación consiste en la división del Número de ejemplares impresos entre el Número de trabajadores registrados en el Estado, multiplicando el resultado por 100. Este cálculo se utiliza para determinar la cobertura o distribución de materiales impresos en relación con la población laboral de una entidad. Un investigador o funcionario buscaría este contenido mediante términos c...


**claude-3-haiku** (3.7s):

La imagen muestra una tabla con dos indicadores relacionados con la difusión de spots publicitarios en radio y televisión. El primer indicador es el "Número de ejemplares impresos", que no tiene un valor numérico asociado. El segundo indicador es el "Número de trabajadores registrados en el Estado", cuyo valor se presenta como un porcentaje. Este tipo de información sería relevante para un abogado, funcionario o investigador que esté analizando los procesos de comunicación y difusión de programa...


</details>

---


### img13.png — Notación matemática (variable técnica)

![Notación matemática (variable técnica)](/images/posts/model-comparison/img13.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

> s instituciones de crédito presentarán sus posturas sin conocer las demás posturas presentadas o cualquier información relacionada. En este caso, la institución postora recibirá la información de las demás posturas hasta que el Banco de México dé a conocer a todas las instituciones de crédito postoras los resultados de la Subasta de Crédito en Dólares conforme a lo dispuesto en el numeral 8, o
> 
> > b) Interactivas: aquellas en que las instituciones de crédito que presenten sus posturas puedan conocer la tasa marginal de asignación de la Subasta de Crédito en Dólares a partir del momento en que e

</details>

<details>
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (2.4s):

Esta imagen consiste en una expresión matemática que representa el subíndice j y el superíndice min, los cuales son elementos técnicos utilizados en la formalización de modelos de subasta. El contenido literal corresponde a la notación matemática j min, empleada para definir variables de optimización o límites en los procesos de asignación de crédito. Este fragmento es fundamental para la interpretación de las reglas de operación de las subastas de crédito en dólares realizadas por el Banco de M...


**gemini-2.5-flash-lite** (1.4s):

Esta imagen representa una notación matemática utilizada en el contexto de subastas de crédito en dólares, específicamente en el Diario Oficial de la Federación. La notación incluye subíndices y superíndices que denotan variables y sus derivadas, como $\dot{j}_j$ y $\dot{m}\dot{n}$. Estos elementos son cruciales para la formulación de modelos económicos y financieros que describen el comportamiento de las instituciones de crédito en procesos de licitación y asignación de recursos. La comprensión...


**gpt-5.4-nano** (3.5s):

La imagen corresponde a un fragmento de texto de un documento legal del DOF sobre Subasta de Crédito en Dólares, específicamente una clasificación de tipos de subastas en el apartado donde se comparan posturas presentadas por instituciones de crédito y el momento en que puede conocerse información de otras posturas. En el contexto se describen las subastas no interactivas o aquellas en que las instituciones de crédito presentarán sus posturas sin conocer las demás posturas ni información relacio...


**grok-4.1-fast** (12.4s):

Esquema o formato administrativo que ilustra las modalidades de Subasta de Crédito en Dólares del Banco de México, diferenciando entre subastas no interactivas (a) e interactivas (b). En las no interactivas, las instituciones de crédito presentan posturas sin conocer las demás ni información relacionada, recibiendo detalles solo hasta que el Banco de México publique resultados conforme al numeral 8. En las interactivas, las postoras conocen la tasa marginal de asignación desde que el monto total...


**gemma-4-31b-it** (8.9s):

Esta imagen es una representación de una fórmula matemática o notación algebraica compuesta por caracteres técnicos. El contenido literal muestra los símbolos i, j y m con subíndices y superíndices, específicamente la letra m con un punto superior y los índices i y j. Debido al contexto del documento, este elemento se relaciona con los procedimientos de las Subastas de Crédito en Dólares coordinadas por el Banco de México. Un investigador o funcionario buscaría este contenido mediante términos c...


**claude-3-haiku** (2.4s):

La imagen muestra una tabla o formato administrativo que contiene información relacionada con una Subasta de Crédito en Dólares. Incluye identificadores legales como "numeral 8" y menciona "instituciones de crédito" y "posturas" en el contexto de dicha subasta. La tabla presenta dos tipos de posturas: "a) Ciegas" y "b) Interactivas", con descripciones detalladas de cada una. Este tipo de contenido sería relevante para abogados, funcionarios o investigadores interesados en regulaciones y procedim...


</details>

---


### img19.png — Tabla vacía (campos de formulario)

![Tabla vacía (campos de formulario)](/images/posts/model-comparison/img19.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

> |
> +-------------------------------------------------------------------------------------------------------------------+----------------------------------------------------------------------+
> | Nombre o Razón Social:                                                                                            | RFC                                                                  |
> |                                                                                                                   |                                                                      |
> |                              

</details>

<details>
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (1.7s):

Esta imagen consiste en un formato administrativo de captura de datos compuesto por una serie de doce casillas rectangulares alineadas horizontalmente. El elemento se encuentra integrado en un formulario oficial diseñado para el registro del Registro Federal de Contribuyentes, comúnmente abreviado como RFC, dentro de documentos legales o administrativos. La estructura de las celdas permite la inserción individual de caracteres alfanuméricos necesarios para la validación de la clave de identifica...


**gemini-2.5-flash-lite** (1.5s):

Esta imagen es un formato administrativo que contiene campos para registrar información legal. Incluye espacios para el "Nombre o Razón Social" y el "RFC", identificadores clave en trámites y registros mercantiles en México. La estructura sugiere la recopilación de datos de personas físicas o morales, esencial para la identificación fiscal y legal. Este tipo de formato es común en documentos del Diario Oficial de la Federación (DOF) relacionados con registros de empresas, trámites fiscales o nor...


**gpt-5.4-nano** (3.1s):

La imagen corresponde a un formato administrativo tipo tabla o formulario del Diario Oficial de la Federación con campos para el registro de datos fiscales, en el que se observa una sección de Nombre o Razón Social y un campo de RFC. El formato presenta renglones o casillas alineadas para capturar el Nombre o Razón Social, seguido de columnas reservadas para el Registro Federal de Contribuyentes (RFC). En el contexto proporcionado, se infiere que el documento busca integrar información del contr...


**grok-4.1-fast** (12.4s):

Es un formato administrativo en tabla con dos columnas principales destinadas a la identificación fiscal de personas morales o físicas. La columna izquierda presenta el campo "Nombre o Razón Social" con espacios en blanco para su llenado, mientras que la derecha está etiquetada como "RFC" para el Registro Federal de Contribuyentes. Este formulario estandarizado se utiliza en trámites fiscales y registros oficiales del Diario Oficial de la Federación. Incluye líneas divisorias para separar los ca...


**gemma-4-31b-it** (9.7s):

Esta imagen es un formato administrativo consistente en una serie de recuadros alineados horizontalmente. El diseño está destinado al llenado de datos alfanuméricos, específicamente para el Registro Federal de Contribuyentes RFC, según se infiere del contexto del documento. Los espacios segmentados permiten la captura individual de caracteres para asegurar la legibilidad de la clave fiscal. Este elemento es fundamental para la identificación tributaria de una persona física o moral en trámites o...


**claude-3-haiku** (3.1s):

La imagen muestra un formato administrativo con espacios en blanco para que el usuario ingrese información. Específicamente, se trata de un campo para ingresar el "Nombre o Razón Social" y otro campo para ingresar el "RFC" (Registro Federal de Contribuyentes). Este tipo de formato es comúnmente utilizado en documentos legales y administrativos mexicanos, como declaraciones fiscales o trámites gubernamentales. Un abogado, funcionario o investigador que busque este tipo de información podría utili...


</details>

---


### img20.png — Mapa geográfico de zona de veda (Sinaloa)

![Mapa geográfico de zona de veda (Sinaloa)](/images/posts/model-comparison/img20.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

> Ley General de Mejora Regulatoria y Quinto del "Acuerdo que fija los lineamientos que deberán ser observados por las dependencias y organismos descentralizados de la Administración Pública Federal, en cuanto a la emisión de los actos administrativos de carácter general a los que les resulta aplicable el artículo 69-H de la Ley Federal de Procedimiento Administrativo", publicado en el Diario Oficial de la Federación, el 8 de marzo de 2017, realizará las acciones de simplificación sobre el trámite indicado en el anexo correspondiente del AIR, en un plazo de seis meses contados a partir de la ent

</details>

<details>
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (2.0s):

Este mapa geográfico detalla la delimitación de la zona de veda permanente para la captura de almeja chocolata Megapitaria squalida en el Sistema Lagunar Altata-Ensenada del Pabellón ubicado en el estado de Sinaloa. La representación cartográfica incluye los municipios de Navolato y Culiacán, marcando puntos de referencia identificados con las letras A, B, C, D, E, F, G, H, I, J y K sobre el litoral del Golfo de California. El área sombreada con líneas diagonales define específicamente la poligo...


**gemini-2.5-flash-lite** (2.7s):

Este es un mapa que muestra la "Zona de veda permanente" para la "Almeja Chocolata (Megapitaria squalida)" en el Sistema Lagunar Altata-Ensenada del Pabellón, Sinaloa. El mapa detalla la ubicación geográfica con coordenadas de latitud y longitud, e identifica puntos clave como Navolato y Culiacán. La zona de veda permanente está representada con un patrón de rayas diagonales y se encuentra en el Golfo de California. El mapa incluye una escala gráfica en kilómetros y señala la presencia de la esp...


**gpt-5.4-nano** (3.1s):

Se trata de un mapa geográfico con señalamiento de zonas y referencia a un sistema lagunar. En el mapa se identifica la península de Baja California y áreas como Golfo de California y Sinaloa, además del Sistema Lagunar Altata-Ensenada del Pabellón, con localidades o puntos etiquetados A, B, C, D, E, F, G, H, I, J, K y L, y una Zona de veda permanente para la Zona de Manejo (Megaprimaria acuadalula) (más) indicando que corresponde a un área de veda permanente. También se muestran rangos de coord...


**grok-4.1-fast** (23.7s):

Mapa geográfico del sistema lagunar Altos-Ensenada del Pabellón en el Golfo de California, abarcando costas de Sinaloa con referencias a Culiacán y límites hacia Sonora. Representa la zona de veda permanente para Almeja Chocolata (Megapanopeus sp.), sombreada con patrones estriados en áreas como Almeja Navolato, Zona Navolato y extensiones lagunarias. Identifica puntos de coordenadas clave A a K, con líneas costeras, lagunas y escala de 0 a 10 km. Incluye paralelos 24.6°N, 24.5°N y 24.4°N, así c...


**gemma-4-31b-it** (17.9s):

Esta imagen es un mapa geográfico que delimita la zona de veda permanente para la Almeja Chocolata Megapitaria squalida. El área sombreada se localiza en el estado de Sinaloa, específicamente en el Sistema Lagunar Altenta-Ensenada del Pabellón, abarcando regiones cercanas a Navolato y Culiacán frente al Golfo de California. El mapa incluye coordenadas geográficas entre 24.4°N y 24.6°N y entre 107.5°O y 107.9°O, además de puntos de referencia marcados con letras de la A a la K. Un investigador o ...


**claude-3-haiku** (3.2s):

La imagen muestra un mapa geográfico que representa el Sistema Lagunar Alacrán-Ensenada del Pabellón, ubicado en el Golfo de California, en los estados de Sinaloa y Nayarito. El mapa incluye la delimitación de la zona de veda permanente (Área Crítica) y otras áreas geográficas relevantes como Navolato y Culiacán. Este mapa sería útil para funcionarios, abogados y académicos que trabajen en temas relacionados con la regulación y administración de recursos naturales, áreas protegidas y zonas coste...


</details>

---


### img21.png — Organigrama de la Auditoría Superior de la Federación

![Organigrama de la Auditoría Superior de la Federación](/images/posts/model-comparison/img21.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

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
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (2.3s):

Este diagrama representa el organigrama estructural de la Auditoría Superior de la Federación, órgano técnico de fiscalización del Congreso de la Unión. La jerarquía está encabezada por el Auditor Superior de la Federación, quien cuenta con el apoyo directo de las áreas de Asesor y la Secretaría del Auditor Superior de la Federación. La estructura operativa se compone de las unidades administrativas Auditoría Especial de Cumplimiento Financiero, Auditoría Especial de Desempeño, Auditoría Especia...


**gemini-2.5-flash-lite** (2.0s):

Este es un organigrama de la Auditoría Superior de la Federación. Muestra la estructura jerárquica de la institución, encabezada por el Auditor Superior de la Federación. Debajo de él se encuentran la Secretaría del Auditor Superior de la Federación y un Asesor, ambos representados con líneas discontinuas, indicando una relación de apoyo o consulta. La estructura principal se desglosa en diversas unidades, incluyendo la Unidad Técnica de la Auditoría Superior de la Federación, Auditoría Especial...


**gpt-5.4-nano** (2.8s):

La imagen es un organigrama del Organigrama de la Auditoría Superior de la Federación que muestra la estructura orgánica y jerárquica de distintas unidades. En la parte superior aparece Auditor Superior de la Federación, con ramas hacia Asesor, y hacia Secretaría del Auditor Superior de la Federación, además de una configuración vertical que conecta con el nivel de unidades y direcciones. En el nivel inferior se identifican como unidades: Unidad Técnica de la Auditoría Superior de la Federación,...


**grok-4.1-fast** (10.6s):

Organigrama jerárquico de la Auditoría Superior de la Federación que muestra la estructura organizacional con el Auditor Superior de la Federación en la cúspide, conectado a un Asesor y a la Secretaría del Auditor Superior de la Federación. De la secretaría se ramifican la Unidad Técnica de la Auditoría Superior de la Federación y diversas Auditorías Especiales, incluyendo Auditoría Especial de Cumplimiento Financiero, Auditoría Especial de Desempeño, Auditoría Especial del Gasto Federalizado, A...


**gemma-4-31b-it** (20.6s):

Este diagrama representa el organigrama de la Auditoría Superior de la Federación. En la parte superior se ubica el Auditor Superior de la Federación, quien cuenta con el apoyo de un Asesor y la Secretaría del Auditor Superior de la Federación. El esquema detalla la estructura jerárquica de las unidades dependientes, incluyendo la Unidad Técnica de la Auditoría Superior de la Federación, la Unidad de Asuntos Jurídicos, la Unidad General de Administración, la Unidad de Normatividad y Enlace Legis...


**claude-3-haiku** (4.5s):

Esta imagen representa un organigrama de la estructura organizacional de la Auditoría Superior de la Federación. Incluye los siguientes elementos:

Auditor Superior de la Federación, que tiene bajo su mando a un Asesor y la Secretaría del Auditor Superior de la Federación. Debajo del Auditor Superior se encuentran diversas unidades y direcciones especializadas, como la Unidad Técnica de la Auditoría Superior de la Federación, Auditorías Especiales (de Cumplimiento Financiero, de Desempeño, del G...


</details>

---


### img22.png — Figura A.7 - Medición de la presión estática externa (NOM-011-ENER-2024)

![Figura A.7 - Medición de la presión estática externa (NOM-011-ENER-2024)](/images/posts/model-comparison/img22.png)

<details>
<summary><strong>Prompt utilizado</strong></summary>

**System prompt:** el prompt v2 (ver arriba).

**Contexto del documento:**

> **Figura A.5 - Aparato de medición de flujo de aire**
> 
> ![](media/image157.png)
> 
> **Figura A.6 - Tobera para la medición del flujo de aire**
> 
> ![](media/image158.png)
> 
> **Figura A.7 - Medición de la presión estática externa**
> 
> ![](media/image159.png)
> 
> **Figura A.8 - Medición de caída de presión estática del aire para una sección de serpentín sin ventiladores**

</details>

<details>
<summary><strong>Respuestas de cada modelo</strong></summary>

**gemini-3.1-flash-lite** (2.7s):

Este diagrama técnico ilustra la medición de caída de presión estática del aire para una sección de serpentín sin ventiladores conforme a la Figura A.8. El esquema detalla la configuración de los ductos de entrada y salida, incluyendo la ubicación de los dispositivos de medición de presión y la conexión hacia el aparato de medición de aire. Se especifican los requerimientos de espacio mediante las variables 1,5 A x B y 0,5 A x B para la salida, así como 0,5 C x D y 1,5 C x D para la entrada. El ...


**gemini-2.5-flash-lite** (3.1s):

Este es un diagrama que ilustra el aparato de medición de aire, mostrando el ducto de salida y el ducto de entrada, ambos equipados con dispositivos de medición de presión. Se detalla una sección de serpentín y se especifican dimensiones relativas como 0,5 A x B y 1,5 A x B para la salida, y 0,5 C x D y 1,5 C x D para la entrada. Las variables A y B representan las dimensiones de salida, mientras que C y D corresponden a las dimensiones de entrada. Este diagrama es relevante para la determinació...


**gpt-5.4-nano** (3.9s):

La imagen corresponde a un diagrama técnico del tipo esquema de aparato de medición de flujo de aire, identificado en el documento como Figura A.5 - Aparato de medición de flujo de aire. Se muestran el Ducto de salida y el Ducto de entrada, con Sección de serpentín y Dispositivos de medición de presión, además de ductos y tomas para medición, incluyendo la representación de la salida y la ubicación de mediciones de presión estática, con indicaciones de dimensiones expresadas como 1,5 A x B y 0,5...


**grok-4.1-fast** (11.1s):

Diagrama esquemático de la Figura A.5 correspondiente al aparato de medición de flujo de aire, que ilustra el ducto de salida con dimensiones 1.5 A x B y dispositivos de medición de presión de 0.5 A x B, conectados a una sección de serpentín central. En la parte inferior se muestra el ducto de entrada con dimensiones 1.5 C x D y dispositivos de medición de presión de 0.5 C x D, con flechas indicadoras de flujo y conexiones tubulares. Las dimensiones A y B se definen como de salida, mientras que ...


**gemma-4-31b-it** (12.5s):

Esta imagen es un diagrama técnico identificado como Figura A.5 Aparato de medición de flujo de aire. El esquema detalla la configuración de un sistema que incluye un ducto de salida, una sección de serpentín y un ducto de entrada, integrando dispositivos de medición de presión en puntos específicos. Se especifican dimensiones y rangos técnicos mediante las fórmulas 1,5 A x B y 0,5 A x B para la salida, así como 1,5 C x D y 0,5 C x D para la entrada. El texto define explícitamente que A y B repr...


**claude-3-haiku** (3.9s):

Esta imagen muestra un diagrama esquemático de un aparato de medición de flujo de aire. Incluye identificadores legales como "Ducto de salida", "Dispositivos de medición de presión", "Sección de serpentín" y "Ducto de entrada", que serían términos clave para buscar este tipo de contenido relacionado con la medición de flujo de aire en documentos legales mexicanos como el Diario Oficial de la Federación. También se incluyen dimensiones de salida y entrada, así como fórmulas para calcular el flujo...


</details>

---


## Observaciones por modelo

**gemini-3.1-flash-lite** (avg 2.8s): Sigue siendo el más rápido junto con gemini-2.5-flash-lite. Genera párrafos bien estructurados. Tiende a incluir más inferencias del contexto cuando la imagen es ambigua.

**gemini-2.5-flash-lite** (avg 2.1s): El más rápido de todos. Respuestas consistentes pero a veces más cortas. Buen balance velocidad/calidad.

**gpt-5.4-nano** (avg 3.7s): Buen rendimiento general. Tiende a ser más literal con el contenido de la imagen. Párrafos bien formados.

**grok-4.1-fast** (avg 15.7s): El más lento por un margen amplio. Respuestas más largas y detalladas. A veces incluye información que no está en la imagen ni el contexto.

**gemma-4-31b-it** (avg 11.4s): Respuestas de calidad variable. A veces excelente, a veces repite patrones. Segundo más lento.

**claude-3-haiku** (avg 3.7s): Consistente como siempre. Respuestas más concisas. Buen manejo de identificadores legales. Bien equilibrado.

## Hallazgos principales

1. **El prompt v2 produce mejor texto para RAG**. Al eliminar las etiquetas, las descripciones son más naturales y fluyen mejor como texto indexable. Los modelos ya no repiten mecánicamente "TIPO: tabla, CONTENIDO LITERAL: ...".

2. **La instrucción de usar el caption funciona**. En imágenes donde el contexto incluía "FIGURA A.7" o títulos de tablas, los modelos lo incorporaron como punto de partida.

3. **La regla "no menciones identificadores si no hay" limpia las respuestas**. Antes los modelos inventaban artículos o leyes que no aparecían. Ahora solo los mencionan cuando están presentes.

4. **Grok es lento pero detallado**. Sus respuestas son consistentemente las más largas. Para un pipeline que procesa ~98k imágenes, el tiempo es un factor importante.

5. **Gemma tiene calidad variable**. A veces produce descripciones excelentes, a veces se pierde en detalles irrelevantes.

6. **El grupo rápido (Gemini Flash, GPT Nano, Claude Haiku)** se mantiene como el mejor balance costo/beneficio. Los tres en promedio entre 2-4 segundos.

## ¿Qué sigue?

- Probar el prompt v2 con un lote más grande de imágenes (50-100) para validar consistencia
- Evaluar las descripciones con métricas de retrieval (no solo calidad percibida)
- Experimentar con modelos locales (LLaVA, etc.) para comparar costos
- Considerar un ensemble: modelo rápido para la mayoría + modelo potente para imágenes complejas
