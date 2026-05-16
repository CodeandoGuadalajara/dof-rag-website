import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

function idToSlug(id) {
  return id.replace(/\.md$/, '').replace(/\/index$/, '');
}

export async function GET(context) {
  const posts = await getCollection('blog');
  
  return rss({
    title: 'DOF-RAG Blog',
    description: 'Seguimiento y documentación de avances en el desarrollo de sistemas de recuperación y generación aumentada para el Diario Oficial de la Federación.',
    site: context.site,
    items: posts.map((post) => {
      const slug = idToSlug(post.id);
      const lang = slug.startsWith('en/') ? 'en' : 'es';
      const slugWithoutLang = slug.replace(/^(en|es)\//, '');
      return {
        title: post.data.title,
        pubDate: post.data.date,
        description: post.data.description || '',
        author: post.data.author,
        link: `${import.meta.env.BASE_URL}/${lang}/blog/${slugWithoutLang}/`,
      };
    }),
    customData: `<language>es-es</language>`,
  });
} 