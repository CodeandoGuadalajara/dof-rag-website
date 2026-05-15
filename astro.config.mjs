// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import remarkAddBasepathToImages from './src/lib/remark-plugins/remark-add-basepath-to-images.js';

export default defineConfig({
  site: 'https://codeandoguadalajara.github.io',
  base: '/dof-rag-website',
  integrations: [],
  output: 'static',
  trailingSlash: 'never',
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
  vite: {
    plugins: [tailwindcss()],
  },
});
