# Blog Dof-Rag

Este es el repositorio para el blog "Dof-Rag".

*(Añade aquí una descripción más detallada sobre de qué trata tu blog).*

## 🚀 Estructura del Proyecto

El proyecto sigue la estructura estándar de Astro:

```text
/
├── public/         # Archivos estáticos (favicon, robots.txt, etc.)
├── src/
│   ├── assets/       # Assets procesados por Astro (imágenes, fuentes, etc.)
│   ├── components/   # Componentes reutilizables de Astro/UI Framework
│   ├── content/      # Colecciones de contenido (Markdown, MDX)
│   │   └── blog/     # Posts del blog
│   ├── layouts/      # Layouts base para páginas y posts
│   ├── pages/        # Páginas y rutas de la aplicación
│   └── styles/       # Estilos globales CSS/SCSS
├── astro.config.mjs  # Configuración de Astro
├── package.json      # Dependencias y scripts del proyecto
└── tsconfig.json     # Configuración de TypeScript
```

Consulta la [documentación de Astro sobre la estructura de proyectos](https://docs.astro.build/es/basics/project-structure/) para más detalles.

## 🧞 Comandos

Todos los comandos se ejecutan desde la raíz del proyecto en una terminal:

| Comando         | Acción                                                 |
| :-------------- | :----------------------------------------------------- |
| `npm install`   | Instala las dependencias                               |
| `npm run dev`   | Inicia el servidor de desarrollo en `localhost:4321`   |
| `npm run build` | Compila el sitio para producción en `./dist/`          |
| `npm run preview`| Previsualiza la compilación de producción localmente |
| `npm run lint`  | Ejecuta ESLint para revisar la calidad del código     |
| `npm run format`| Formatea el código con Prettier                      |

## ✨ Características y Mejoras

*   **Tailwind CSS:** Utilizado para el estilizado rápido y consistente.
*   **Modo Oscuro/Claro:** Interruptor para cambiar el tema visual.
*   **Optimización de Assets:** Se recomienda usar [`astro:assets`](https://docs.astro.build/es/guides/assets/) para optimizar imágenes y otros activos.
*   **Accesibilidad:** Es importante asegurar que el sitio sea usable por todos. Revisa el contraste de colores, el uso de HTML semántico, texto alternativo para imágenes y la navegación por teclado. Herramientas como [axe DevTools](https://www.deque.com/axe-devtools/) pueden ayudar.

## 🤝 Contribuir

*(Añade aquí información sobre cómo otros pueden contribuir a tu proyecto, si aplica).*

```sh
npm create astro@latest -- --template basics
```

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/basics)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/basics)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/basics/devcontainer.json)

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

![just-the-basics](https://github.com/withastro/astro/assets/2244813/a0a5533c-a856-4198-8470-2d67b1d7c554)

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
