// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://codeandoguadalajara.github.io/dof-rag-website/',
  base: '/dof-rag-website/',
  output: 'static', 
  integrations: [
    tailwind(),
  ]
});