import type { CollectionEntry } from 'astro:content';

/**
 * Converts a content collection entry `id` (e.g. `en/my-post.md`)
 * to a URL-friendly slug by stripping the `.md` extension and any trailing `/index`.
 */
export function idToSlug(id: string): string {
  return id.replace(/\.md$/, '').replace(/\/index$/, '');
}

/**
 * Strips the language prefix (`en/` or `es/`) from a slug.
 */
export function stripLangPrefix(slug: string): string {
  if (slug.startsWith('en/') || slug.startsWith('es/')) {
    return slug.substring(3);
  }
  return slug;
}

/**
 * Returns the language of a blog entry based on its id prefix. Defaults to 'es'.
 */
export function getEntryLang(id: string): 'en' | 'es' {
  return idToSlug(id).startsWith('en/') ? 'en' : 'es';
}

/**
 * Builds the dated URL path (`YYYY/MM/slug`) for a blog entry.
 *
 * Content files are stored flat (`blog/{lang}/{slug}.md`), but URLs keep a
 * date prefix derived from the `date` frontmatter so that published URLs
 * remain stable no matter how files are organized on disk.
 */
export function getPostUrlPath(entry: CollectionEntry<'blog'>): string {
  const slug = stripLangPrefix(idToSlug(entry.id));
  const rawDate = entry.data.date;
  const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}/${mm}/${slug}`;
}
