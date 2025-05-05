import { siteConfig } from './config';

/**
 * Normaliza las rutas de imágenes para asegurar que tengan el prefijo correcto
 * Útil cuando se trabaja con TinaCMS y la ruta base
 */
export function normalizeImagePath(imagePath) {
  return siteConfig.imagePath(imagePath);
}

/**
 * Transformador para corregir las rutas de imágenes en el contenido markdown
 * Puede ser usado para post-procesar el contenido generado por TinaCMS
 */
export function fixMarkdownImagePaths(content) {
  // Busca todas las instancias de ![alt](path) y asegura que path incluya la ruta base
  return content.replace(
    /!\[(.*?)\]\((.*?)\)/g, 
    (match, alt, path) => {
      const fixedPath = normalizeImagePath(path);
      return `![${alt}](${fixedPath})`;
    }
  );
}

/**
 * Función para preparar los datos antes de usarlos con TinaCMS
 */
export function prepareTinaData(data) {
  // Asegúrate de que los datos tengan el formato correcto para TinaCMS
  if (!data) return null;
  
  // Normaliza las rutas de imágenes
  if (data.image) {
    data.image = normalizeImagePath(data.image);
  }
  
  return data;
} 