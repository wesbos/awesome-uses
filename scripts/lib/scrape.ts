/**
 * Shared helpers for scripts that write to D1 via the wrangler CLI.
 *
 * Scraping logic lives in src/server/scrape.ts — scripts should import
 * from there so the hashing / markdown conversion stays in sync with
 * the app.
 */

export function sqlValue(value: string | number | null): string {
  if (value === null || typeof value === 'undefined') return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}
