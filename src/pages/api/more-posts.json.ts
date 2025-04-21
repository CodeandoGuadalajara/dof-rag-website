import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const limit = parseInt(url.searchParams.get('limit') || '6', 10);

  try {
    // Obtener todos los posts (excepto borradores)
    const allPosts = await getCollection('blog', ({ data }) => !data.draft);
    
    // Ordenar por fecha descendente
    const sortedPosts = [...allPosts].sort((a, b) => 
      b.data.date.getTime() - a.data.date.getTime()
    );
    
    // Aplicar paginación
    const paginatedPosts = sortedPosts.slice(offset, offset + limit);
    
    // Transformar para JSON
    const formattedPosts = paginatedPosts.map(post => ({
      slug: post.slug,
      title: post.data.title,
      date: post.data.date.toISOString(),
      description: post.data.description || 'Sin descripción disponible',
      image: post.data.image ? post.data.image.toString() : null,
      author: post.data.author || 'Autor desconocido'
    }));
    
    // Determinar si hay más posts disponibles
    const hasMore = offset + limit < sortedPosts.length;
    
    return new Response(
      JSON.stringify({
        posts: formattedPosts,
        hasMore,
        total: sortedPosts.length
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error al obtener posts:', error);
    return new Response(
      JSON.stringify({
        error: 'Error al obtener posts',
        message: error instanceof Error ? error.message : 'Error desconocido'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}; 