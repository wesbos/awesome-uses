const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const NON_SLUG_CHARS_REGEX = /[^a-z0-9]+/g;
const LEADING_TRAILING_DASHES_REGEX = /^-+|-+$/g;

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(DIACRITICS_REGEX, '')
    .toLowerCase()
    .replace(NON_SLUG_CHARS_REGEX, '-')
    .replace(LEADING_TRAILING_DASHES_REGEX, '')
    .slice(0, 96);
}

export function buildUniqueSlug(
  baseInput: string,
  used: Set<string>,
  fallbackPrefix: string
): string {
  const baseSlug = slugify(baseInput) || fallbackPrefix;
  let attempt = baseSlug;
  let counter = 2;
  while (used.has(attempt)) {
    attempt = `${baseSlug}-${counter}`;
    counter += 1;
  }
  used.add(attempt);
  return attempt;
}
