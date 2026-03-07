# Uses.tech Operations Toolkit

## Unified site-management toolkit (CLI + MCP + REST)

The canonical operations surface is now `src/site-management`, available through:

- CLI: `pnpm site:tools:list`, `pnpm site:tools:call <tool> --input '{...}'`
- MCP: `pnpm site:tools:mcp`
- REST API: `pnpm site:tools:api`

Full usage guide:

- `docs/site-management-toolkit.md`

## Cull invalid /uses pages

Dry-run (default):

```bash
pnpm cull
```

Apply changes directly to `src/data.js`:

```bash
pnpm cull -- --apply
```

Useful flags:

- `--limit 100`
- `--concurrency 20`
- `--timeout 12000`
- `--retries 2`

## Scrape /uses pages into Cloudflare D1

Run against local D1:

```bash
pnpm scrape -- --db uses-tech-scrapes
```

Run against remote D1:

```bash
pnpm scrape -- --db uses-tech-scrapes --remote
```

Useful flags:

- `--person wes` (filter by name/url substring)
- `--limit 50`
- `--concurrency 8`
- `--timeout 12000`
- `--retries 2`

## Generate static tag metadata

```bash
pnpm generate:tag-metadata
```

This updates:

- `src/generated/tag-aliases.json`
- `src/generated/tag-groups.json`

## Sync app snapshot from `src/data.js`

The web app runtime reads `src/generated/people.json` (generated from `src/data.js`).
Run this manually when editing `src/data.js` directly:

```bash
pnpm sync:data
```

`dev`, `build`, `test`, and `typecheck` already run this automatically.
