// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://jorge5452.github.io',
  base: '/Blog-Dof-Rag',
  output: 'static', // Cambiado de 'server' a 'static' para GitHub Pages
  integrations: [
    tailwind(),
  ]
});