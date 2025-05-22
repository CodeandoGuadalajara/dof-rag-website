// Configuración global para el sitio
export const siteConfig = {
  name: "DOF-RAG Website",
  description: "Blog del proyecto DOF-RAG sobre análisis de documentos del Diario Oficial de la Federación",
  basePath: "/dof-rag-website",
  // Función para asegurar que las rutas de imágenes tengan el prefijo correcto
  imagePath: (path) => {
    // Si la ruta ya comienza con la ruta base, devuelve la ruta original
    if (path && path.startsWith("/dof-rag-website")) {
      return path;
    }
    
    // Si la ruta comienza con /, simplemente agrega la ruta base
    if (path && path.startsWith("/")) {
      return `/dof-rag-website${path}`;
    }
    
    // Si la ruta no comienza con /, agrega / y la ruta base
    if (path) {
      return `/dof-rag-website/${path}`;
    }
    
    // Si no hay ruta, devuelve una imagen predeterminada
    return "/dof-rag-website/images/default.jpg";
  },
  
  // Configuración para el sistema de comentarios Giscus
  giscus: {
    // Información del repositorio
    repo: "CodeandoGuadalajara/dof-rag-website",
    repoId: "R_kgDOOikkDg",
    category: "General",
    categoryId: "DIC_kwDOOikkDs4Cqb2K",
    mapping: "pathname",
    reactionsEnabled: "1",
    emitMetadata: "0",
    inputPosition: "bottom",
    theme: "preferred_color_scheme",
    lang: "es",
    loading: "lazy"
  }
}; 