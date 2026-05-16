/**
 * Converts a content collection entry `id` (e.g. `en/2025/04/my-post/index.md`)
 * to a URL-friendly slug by stripping the `.md` extension and any trailing `/index`.
 */
export function idToSlug(id: string): string {
  return id.replace(/\.md$/, '').replace(/\/index$/, '');
}

/**
 * Strips the language prefix (`en/` or `es/`) from a slug so it can be used
 * as the path segment after `/{lang}/blog/`.
 */
export function prepareSlug(id: string): string {
  const slug = idToSlug(id);
  if (slug.startsWith('en/') || slug.startsWith('es/')) {
    return slug.substring(3);
  }
  return slug;
}
