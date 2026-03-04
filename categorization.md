# AI Item Extraction

Scraped /uses pages are processed with an LLM to extract structured `{ item, tags[], detail }` data.

- **tags**: canonical lowercase labels from a fixed list (e.g. `monitor`, `keyboard`, `terminal`) — an item can have many tags
- **detail**: optional context like size, model number, color

Requires `OPENAI_API_KEY` in `.env`. Results go into the `person_items` D1 table.

## Phases

### Phase 1: Discover

Sample pages and let the LLM freely tag items. Outputs tag/item frequency data to `src/generated/discovery-results.json`.

```bash
pnpm discover --sample 50
```

### Phase 2: Canonicalize

Merge synonym tags, drop rare ones, produce a locked canonical tag list at `src/generated/item-tags.json`. Review and hand-edit the output before proceeding.

```bash
pnpm canonicalize
```

### Phase 3: Extract

Run every scraped page through the LLM constrained to the canonical tag list. Writes to the `person_items` D1 table. Skips already-extracted people by default.

```bash
pnpm extract
pnpm extract -- --person wes-bos --force
pnpm extract -- --limit 100 --concurrency 10
```

### Phase 4: Aggregate

(Not yet built.) Count items across all people to build leaderboards — e.g. "VS Code: 428 people", "LG 27UK850: 47 people". Group tags into categories after seeing the full data.
