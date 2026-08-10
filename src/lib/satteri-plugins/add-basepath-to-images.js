// El basePath debe coincidir con el configurado en astro.config.mjs
const basePath = '/dof-rag-website';

export default {
  name: 'add-basepath-to-images',
  image(node, ctx) {
    const url = node.url;
    if (
      typeof url === 'string' &&
      url.startsWith('/') &&
      !url.startsWith(`${basePath}/`)
    ) {
      ctx.setProperty(node, 'url', `${basePath}${url}`);
    }
  },
};
