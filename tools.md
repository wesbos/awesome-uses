# Uses.tech Operations Toolkit

## Cull invalid /uses pages

Dry-run (default):

```bash
npm run cull
```

Apply changes directly to `src/data.js`:

```bash
npm run cull -- --apply
```

Useful flags:

- `--limit 100`
- `--concurrency 20`
- `--timeout 12000`
- `--retries 2`

## Scrape /uses pages into Cloudflare D1

Run against local D1:

```bash
npm run scrape -- --db uses-tech-scrapes
```

Run against remote D1:

```bash
npm run scrape -- --db uses-tech-scrapes --remote
```

Useful flags:

- `--person wes` (filter by name/url substring)
- `--limit 50`
- `--concurrency 8`
- `--timeout 12000`
- `--retries 2`

## Generate static tag metadata

```bash
npm run generate:tag-metadata
```

This updates:

- `src/generated/tag-aliases.json`
- `src/generated/tag-groups.json`
