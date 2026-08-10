import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Colección de posts del blog
 */
const blogCollection = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/.*.md'], base: './src/content/blog' }),
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
