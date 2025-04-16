import { defineCollection, z } from 'astro:content';

/**
 * Colección de posts del blog
 */
const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.union([
      z.string().transform((str) => new Date(str)),
      z.date()
    ]),
    author: z.string(),
    description: z.string().optional(),
    image: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
    featured: z.boolean().optional().default(false),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = {
  'blog': blogCollection,
}; 