// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import tailwindcss from '@tailwindcss/vite';
import addBasepathToImages from './src/lib/satteri-plugins/add-basepath-to-images.js';

export default defineConfig({
  site: 'https://codeandoguadalajara.github.io',
  base: '/dof-rag-website',
  integrations: [],
  image: {
    service: passthroughImageService(),
  },
  output: 'static',
  prefetch: true,
  // Redirecciones para URLs antiguas que cambiaron al aplanar la estructura del blog
  redirects: {
    '/es/blog/2025/08/comparacion-embeddings/la-batalla-de-los-embeddings-cuando-tres-modelos-de-ia-compiten-por-entender-el-espaol-gubernamental':
      '/dof-rag-website/es/blog/2025/08/la-batalla-de-los-embeddings-cuando-tres-modelos-de-ia-compiten-por-entender-el-espaol-gubernamental',
    '/en/blog/2025/08/comparacion-embeddings/la-batalla-de-los-embeddings-cuando-tres-modelos-de-ia-compiten-por-entender-el-espaol-gubernamental':
      '/dof-rag-website/en/blog/2025/08/la-batalla-de-los-embeddings-cuando-tres-modelos-de-ia-compiten-por-entender-el-espaol-gubernamental',
  },
  // GitHub Pages serves directory URLs with a trailing slash; accept both
  // forms locally and in production while canonical links choose one URL.
  trailingSlash: 'ignore',
  // Configuración para manejar páginas dinámicas en GitHub Pages
  build: {
    format: 'directory',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    processor: satteri({
      mdastPlugins: [addBasepathToImages],
      // Keep the site's typographic quotes and ellipses without rewriting the
      // repeated hyphens used in prompts and ASCII tables as en/em dashes.
      features: {
        smartPunctuation: { quotes: true, dashes: false, ellipses: true },
      },
    }),
  },
  server: {
    port: 4321,
    host: true,
  },
});
