# Site Management Toolkit

Unified management operations for the site are exposed through three surfaces:

1. **CLI** (agent-friendly JSON)
2. **MCP route in app** (tool calling)
3. **REST route in app** (HTTP)

All surfaces call the same tool registry in `src/site-management`.

## Tool groups

- `people.*`
- `profileTags.*`
- `tags.*`
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

## REST API route

The REST API is served by the TanStack Start app route:

- `GET /api/site-management` (tool metadata)
- `POST /api/site-management` (tool execution)

### Endpoints

- `GET /api/site-management`
- `POST /api/site-management`

### Example calls

```bash
curl -s -X POST http://127.0.0.1:7535/api/site-management \
  -H 'content-type: application/json' \
  -d '{"tool":"people.list","input":{"limit":10,"offset":0}}' | jq
```

## MCP route

The MCP server is exposed by the TanStack Start app route:

- `GET /mcp` (metadata)
- `POST /mcp` (JSON-RPC)

Supported JSON-RPC methods:

- `initialize`
- `tools/list`
- `tools/call`

```bash
curl -s -X POST http://127.0.0.1:7535/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"pipeline.scrapePerson","arguments":{"personSlug":"wes-bos","timeoutMs":12000,"retries":1}}}' | jq
```

## Pipeline notes

`pipeline.*` operations cover the full ingest lifecycle:

- scrape status/errors
- scrape single/batch
- re-scrape + extract single
- extract batch
- discover/review/reclassify tags
- vectorize single/batch
- similarity and galaxy data

Vectorization requires `OPENAI_API_KEY`.  
If unavailable, vectorization tools return structured errors/reasons instead of crashing.
