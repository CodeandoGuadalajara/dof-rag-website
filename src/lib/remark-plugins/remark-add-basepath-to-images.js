import { visit } from 'unist-util-visit';

// El basePath debe coincidir con el configurado en astro.config.mjs
const basePath = '/dof-rag-website';

export default function remarkAddBasepathToImages() {
  return (tree) => {
    visit(tree, 'image', (node) => {
      // console.log(`Plugin: processing image node. URL: ${node.url}`); // Log para depuración
      if (node.url) {
        // Si es una ruta relativa a la raíz (empieza con /) y no es externa
        if (node.url.startsWith('/') && !node.url.includes('://')) {
          // Solo añadir basePath si NO empieza ya con él
          if (!node.url.startsWith(basePath + '/')) {
            // console.log(`Plugin: Modifying URL. Original: ${node.url}`); // Log para depuración
            // Asegurarse de que el basePath termina con / y que node.url empieza con /
            // para evitar doble barra o falta de barra
            const cleanNodeUrl = node.url.startsWith('/') ? node.url.substring(1) : node.url;
            node.url = `${basePath}/${cleanNodeUrl}`;
            // console.log(`Plugin: Modified URL. New: ${node.url}`); // Log para depuración
          }
        }
      }
    });
  };
} 