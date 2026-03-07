# Site Management Toolkit

Unified management operations for the site are exposed through three surfaces:

1. **CLI** (agent-friendly JSON)
2. **MCP server** (tool calling)
3. **REST API** (HTTP)

All surfaces call the same tool registry in `src/site-management`.

## Tool groups

- `people.*`
- `profileTags.*`
- `categories.*`
- `personItems.*`
- `items.*`
- `pipeline.*` (scrape/extract/reclassify/vectorize/similarity)

## Prerequisites

- Install dependencies: `pnpm install`
- Local D1 database path must be available (or override it):
  - `SITE_DB_PATH=/absolute/path/to/local.sqlite`

Optional overrides:

- `SITE_REPO_ROOT`
- `SITE_DATA_FILE_PATH`
- `SITE_GENERATED_PEOPLE_PATH`

## CLI

### List all tools

```bash
pnpm site:tools:list
```

### Call a tool with inline JSON

```bash
pnpm site:tools:call people.list --input '{"limit": 20, "offset": 0}'
```

### Call a tool using a JSON file

```bash
pnpm site:tools:call items.merge --input-file ./merge-input.json
```

Example `merge-input.json`:

```json
{
  "canonicalItem": "VS Code",
  "sourceItems": ["VSCode", "Visual Studio Code"]
}
```

## MCP server

Run as a stdio MCP server:

```bash
pnpm site:tools:mcp
```

The server exposes all registry tools directly to MCP clients.

## REST API

Start the API server (default `127.0.0.1:8788`):

```bash
pnpm site:tools:api
```

Custom port:

```bash
pnpm site:tools:api --port 8789
```

### Endpoints

- `GET /health`
- `GET /tools`
- `POST /tools/:name`

### Example calls

```bash
curl -s http://127.0.0.1:8788/tools | jq
```

```bash
curl -s -X POST http://127.0.0.1:8788/tools/people.list \
  -H 'content-type: application/json' \
  -d '{"input":{"limit":10,"offset":0}}' | jq
```

```bash
curl -s -X POST http://127.0.0.1:8788/tools/pipeline.scrapePerson \
  -H 'content-type: application/json' \
  -d '{"input":{"personSlug":"wes-bos","timeoutMs":12000,"retries":1}}' | jq
```

## Pipeline notes

`pipeline.*` operations cover the full ingest lifecycle:

- scrape status/errors
- scrape single/batch
- re-scrape + extract single
- extract batch
- discover/review/reclassify categories
- vectorize single/batch
- similarity and galaxy data

Vectorization requires `OPENAI_API_KEY`.  
If unavailable, vectorization tools return structured errors/reasons instead of crashing.
