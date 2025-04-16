// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import decapCmsOauth from 'astro-decap-cms-oauth';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  output: 'server', // Necesario para las rutas OAuth
  adapter: netlify(),
  experimental: {
    session: true // Habilitar sesiones experimentales
  },
  integrations: [
    tailwind(),
    decapCmsOauth({
      // Configuración por defecto
      adminRoute: '/admin',
      oauthLoginRoute: '/oauth',
      oauthCallbackRoute: '/oauth/callback',
    })
  ]
});