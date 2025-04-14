# DOF-RAG Blog

Un blog especializado en documentar el desarrollo e implementación de un sistema de Generación Aumentada por Recuperación (RAG) para el Diario Oficial de la Federación de México.

## 📑 Acerca del Proyecto

El Proyecto DOF-RAG busca transformar la manera en que ciudadanos, investigadores, profesionales del derecho y funcionarios públicos acceden e interactúan con la información legislativa y regulatoria de México. Mediante tecnologías avanzadas de procesamiento de lenguaje natural, vectorización semántica y modelos de lenguaje de gran escala, nos proponemos:

- **Mejorar la comprensión** de documentos oficiales
- **Facilitar la recuperación** específica de datos relevantes
- **Generar respuestas precisas** a consultas sobre normativas

## 🔧 Tecnologías Implementadas

- **[Astro](https://astro.build/)**: Framework web de alto rendimiento con enfoque en contenido estático
- **[Tailwind CSS](https://tailwindcss.com/)**: Framework CSS para diseño rápido y responsivo
- **[Content Collections](https://docs.astro.build/en/guides/content-collections/)**: Sistema integrado para gestión de contenido estructurado
- **Modo Oscuro/Claro**: Cambio automático y manual de tema según preferencias del usuario

## 🚀 Estructura del Proyecto

```text
/
├── public/               # Archivos estáticos (imágenes, favicon)
│   └── images/           # Imágenes optimizadas para posts
│       └── posts/        # Organizado por año/mes
├── src/
│   ├── assets/           # Assets procesados (fuentes, iconos)
│   ├── components/       # Componentes reutilizables
│   ├── content/          # Content Collections (blog)
│   │   └── blog/         # Estructura de blog organizada por año/mes
│   ├── layouts/          # Plantillas para páginas y posts
│   ├── pages/            # Rutas y páginas de la aplicación
│   └── styles/           # Estilos globales CSS
├── astro.config.mjs      # Configuración de Astro
└── tailwind.config.cjs   # Configuración de Tailwind CSS
```

## 📊 Características del Blog

- **Sistema de tags**: Categorización precisa de contenido
- **Posts destacados**: Resalte de contenido importante
- **Diseño responsivo**: Experiencia óptima en todos los dispositivos

## 🧞 Comandos de Desarrollo

| Comando         | Acción                                                 |
| :-------------- | :----------------------------------------------------- |
| `npm install`   | Instala las dependencias                               |
| `npm run dev`   | Inicia el servidor de desarrollo en `localhost:4321`   |
| `npm run build` | Compila el sitio para producción en `./dist/`          |
| `npm run preview`| Previsualiza la compilación de producción localmente |
| `npm run lint`  | Ejecuta ESLint para revisar la calidad del código     |
| `npm run format`| Formatea el código con Prettier                      |

---

Desarrollado con 💜 utilizando [Astro](https://astro.build)
