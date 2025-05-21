// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import remarkAddBasepathToImages from './src/lib/remark-plugins/remark-add-basepath-to-images.js';

export default defineConfig({
  site: 'https://codeandoguadalajara.github.io',
  base: '/dof-rag-website',
  integrations: [tailwind()],
  output: 'static',
  // Cambiar a 'never' para evitar problemas con las rutas en GitHub Pages
  trailingSlash: 'never',
  // Configuración para manejar páginas dinámicas en GitHub Pages
  build: {
    format: 'directory'
  },
  markdown: {
    remarkPlugins: [remarkAddBasepathToImages],
  },
  server: {
    port: 4321,
    host: true
  },
  // Configuración de rutas para asegurar que TinaCMS funcione correctamente
  vite: {
    resolve: {
      alias: {
        '/@fs/': '/'
      }
    }
  }
});