import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

// En modo server, necesitamos usar la estructura de endpoint de Astro
export async function GET(context) {
  const posts = await getCollection('blog');
  
  return rss({
    title: 'DOF-RAG Blog',
    description: 'Seguimiento y documentación de avances en el desarrollo de sistemas de recuperación y generación aumentada para el Diario Oficial de la Federación.',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description || '',
      author: post.data.author,
      link: `${import.meta.env.BASE_URL}/blog/${post.slug}/`,
    })),
    customData: `<language>es-es</language>`,
  });
} 