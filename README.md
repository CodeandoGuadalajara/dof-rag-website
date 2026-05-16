# Blog DOF-RAG

Blog del proyecto DOF-RAG, una iniciativa para mejorar la accesibilidad de la información del Diario Oficial de la Federación mediante tecnologías de procesamiento de lenguaje natural.

## 📑 Acerca del Proyecto

El Proyecto DOF-RAG busca transformar la manera en que ciudadanos, investigadores, profesionales del derecho y funcionarios públicos acceden e interactúan con la información legislativa y regulatoria de México. Mediante tecnologías avanzadas de procesamiento de lenguaje natural, vectorización semántica y modelos de lenguaje de gran escala, nos proponemos:

- **Mejorar la comprensión** de documentos oficiales
- **Facilitar la recuperación** específica de datos relevantes
- **Generar respuestas precisas** a consultas sobre normativas

## 🔧 Tecnologías Implementadas

- **[Astro](https://astro.build/)**: Framework web de alto rendimiento con enfoque en contenido estático.
- **[Tailwind CSS](https://tailwindcss.com/)**: Framework CSS para diseño rápido y responsivo.
- **[TinaCMS](https://tina.io/)**: Headless CMS basado en Git para edición de contenido.
- **[Content Collections](https://docs.astro.build/en/guides/content-collections/)**: Sistema integrado de Astro para gestión de contenido estructurado.
- **[Giscus](https://giscus.app/)**: Sistema de comentarios impulsado por GitHub Discussions.
- **Remark Plugin Personalizado**: Para corrección automática de rutas de imágenes (ver sección Manejo de Rutas).
- **Modo Oscuro/Claro**: Cambio automático y manual de tema según preferencias del usuario.

## 🚀 Estructura del Proyecto

```text
/
├── public/               # Archivos estáticos (imágenes, favicon)
│   └── images/           # Imágenes gestionadas por TinaCMS
│       └── posts/        # Subcarpeta para posts
├── src/
│   ├── assets/           # Assets procesados por Astro (fuentes, iconos)
│   ├── components/       # Componentes Astro reutilizables
│   │   └── GiscusComments.astro  # Componente para sistema de comentarios
│   ├── content/          # Content Collections (blog)
│   │   └── blog/         # Contenido de los posts en Markdown
│   ├── layouts/          # Plantillas Astro para páginas y posts
│   ├── lib/              # Librerías o utilidades JS/TS
│   │   └── remark-plugins/ # Plugins personalizados para Remark
│   ├── pages/            # Rutas y páginas de la aplicación Astro
│   └── styles/           # Estilos globales CSS
├── .github/              # Configuración de GitHub Actions (despliegue)
├── tina/                 # Configuración de TinaCMS (schema, etc.)
├── astro.config.mjs      # Configuración de Astro (integraciones, basePath, plugins)
├── tailwind.config.js    # Configuración de Tailwind CSS
└── package.json          # Dependencias y scripts
```

## 📊 Características del Blog

- **Sistema de tags**: Categorización precisa de contenido.
- **Posts destacados**: Resalte de contenido importante.
- **Diseño responsivo**: Experiencia óptima en todos los dispositivos.
- **Edición de contenido con TinaCMS**: Interfaz visual para editar posts.
- **Sistema de comentarios con Giscus**: Comentarios integrados utilizando GitHub Discussions.

## 🧞 Comandos de Desarrollo

| Comando         | Acción                                                          |
| :-------------- | :-------------------------------------------------------------- |
| `pnpm install`   | Instala las dependencias del proyecto.                          |
| `pnpm dev`   | Inicia el servidor de desarrollo Astro con TinaCMS (`localhost:4321`). |
| `pnpm build` | Compila el sitio estático para producción en `./dist/`.           |
| `pnpm preview`| Previsualiza la compilación de producción localmente.          |
| `pnpm lint`  | Ejecuta ESLint para revisar la calidad del código.              |
| `pnpm format`| Formatea el código con Prettier.                               |

## Desarrollo

```bash
# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo con TinaCMS
pnpm dev

# Compilar para producción
pnpm build
```

## Configuración de TinaCMS

Este proyecto utiliza TinaCMS como sistema de gestión de contenido. Para que funcione correctamente, sigue estos pasos:

1.  Registra tu proyecto en [TinaCMS Cloud](https://app.tina.io/) para obtener las credenciales necesarias.
2.  Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:
    ```
    TINA_PUBLIC_CLIENT_ID=tu-client-id
    TINA_TOKEN=tu-token
    ```

3.  Para desarrollo local, accede al panel de administración en:
    ```
    http://localhost:4321/admin/
    ```

4.  Para el entorno de producción (GitHub Pages), accede al panel en:
    ```
    https://[tu-usuario-github].github.io/dof-rag-website/admin/
    ```

**Nota sobre `build.basePath`:** Aunque la configuración `build.basePath: "dof-rag-website"` está definida en `tina/config.js`, la experiencia actual indica que TinaCMS no siempre aplica este prefijo al *guardar* las rutas de las imágenes en los archivos Markdown. Por ello, se implementan las soluciones descritas a continuación.

## Manejo de Rutas de Imágenes (`basePath`)

Debido a que el sitio se despliega en GitHub Pages bajo una subruta (`/dof-rag-website/`), es crucial que todas las URL de las imágenes incluyan este `basePath`. Así es como se maneja:

*   **Imagen de Portada (Frontmatter - campo `image`):**
    *   TinaCMS guarda la ruta relativa a la carpeta pública (ej: `/images/posts/imagen.webp`).
    *   Los layouts de Astro (ej: `src/layouts/BlogPostLayout.astro`, `src/pages/index.astro`) que muestran esta imagen se encargan de añadir dinámicamente el `basePath` (`import.meta.env.BASE_URL`) al construir la etiqueta `<img>`.

*   **Imágenes en Cuerpo (Markdown - campo `body`):**
    *   El editor de texto enriquecido de TinaCMS inserta las imágenes con la ruta relativa a la carpeta pública (ej: `![](/images/imagen.jpg)`).
    *   Se utiliza un **plugin de Remark personalizado** (`src/lib/remark-plugins/remark-add-basepath-to-images.js`), configurado en `astro.config.mjs`, que se ejecuta durante el renderizado de Astro.
    *   Este plugin **añade automáticamente el `basePath`** a las rutas de imagen que comienzan con `/` (y no son externas), transformando `![](/images/...)` en `![](/dof-rag-website/images/...)` en el HTML final.
    *   **Importante:** Aunque en el archivo fuente `.md` la ruta aparezca sin el `basePath`, el plugin asegura que la ruta sea correcta en la página renderizada.

## Despliegue en GitHub Pages

Este proyecto está configurado para desplegarse automáticamente en GitHub Pages mediante GitHub Actions.

### Configuración de secretos para TinaCMS

Para que el panel de administración de TinaCMS funcione correctamente en GitHub Pages, necesitas configurar los siguientes secretos en tu repositorio de GitHub:

1.  Ve a Settings > Secrets and variables > Actions
2.  Añade los siguientes secretos:
    *   `TINA_PUBLIC_CLIENT_ID`: Tu ID de cliente de TinaCMS
    *   `TINA_TOKEN`: Tu token de autenticación de TinaCMS

## Solución de problemas comunes

### Error 404 en `/admin`

Si encuentras un error 404 al intentar acceder al panel de administración, verifica:

1.  Que has iniciado el servidor con el comando correcto: `pnpm dev`.
2.  Que has completado la configuración en `tina/config.js` y `astro.config.mjs`.
3.  Que los secretos de GitHub están configurados correctamente (para producción).

### Error 404 en Imágenes

Si las imágenes no se cargan (error 404 en la consola del navegador):

1.  Verifica que el archivo de imagen exista realmente en la carpeta `public/images/`.
2.  Asegúrate de que los layouts de Astro estén añadiendo `import.meta.env.BASE_URL` a las imágenes del frontmatter.
3.  Confirma que el plugin Remark (`remark-add-basepath-to-images`) esté correctamente configurado en `astro.config.mjs` para manejar las imágenes del cuerpo del Markdown.
4.  Inspecciona el HTML generado en el navegador para asegurarte de que todas las rutas `src` de las `<img>` incluyan el prefijo `/dof-rag-website/`.

### Error 404 en la URL raíz (después del despliegue)

Si la URL raíz (`https://[usuario].github.io/dof-rag-website/`) devuelve un 404, asegúrate de que:

1.  La configuración `base` en `astro.config.mjs` coincida exactamente con el nombre de tu repositorio (`/dof-rag-website`).
2.  El archivo `.nojekyll` se esté creando correctamente en el directorio `dist` durante el `pnpm build` (esto suele ser automático con Astro estático).

## Configuración del Sistema de Comentarios (Giscus)

El blog utiliza [Giscus](https://giscus.app/) como sistema de comentarios, que funciona basado en GitHub Discussions. Para configurarlo correctamente:

1. Asegúrate de que tu repositorio en GitHub sea **público** y tenga habilitada la función de **Discussions**.
2. Instala la [aplicación Giscus](https://github.com/apps/giscus) en tu repositorio.
3. Visita [giscus.app](https://giscus.app/) y configura las opciones según tus preferencias.
4. Actualiza los valores de configuración en `src/config.js` con los IDs y parámetros generados por Giscus:
   ```js
   giscus: {
     repo: "tu-usuario/tu-repositorio",
     repoId: "ID-generado-por-giscus",
     category: "Nombre-de-categoria",
     categoryId: "ID-generado-por-giscus",
     // ... otros parámetros
   }
   ```

Los comentarios aparecerán automáticamente al final de cada post del blog. El componente `GiscusComments.astro` gestiona la renderización e integración del widget de comentarios.

---

test

Desarrollado con 💜 utilizando [Astro](https://astro.build)
