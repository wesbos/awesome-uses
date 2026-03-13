---
name: deduplicate-items
description: Find and merge duplicate item names in the site database using the CLI. Use when the user asks to deduplicate, merge, clean up, or consolidate items — optionally filtered by tag (e.g. "headphones", "keyboard", "editor").
---

# Deduplicate Items

Find variant spellings / naming inconsistencies for items in the site database and merge them into canonical names via the CLI.

## Prerequisites

- Working directory: the repo root (`/Users/wesbos/Dropbox/awesome-uses`)
- Dependencies installed (`pnpm install`)
- Local D1 SQLite database available (auto-resolved from `.wrangler/`)

## Workflow

### 1. List items for the target tag

Paginate through **all** results — the API returns at most 100 rows per call.

```bash
pnpm site:tools:call items.list --input '{"tag": "<TAG>", "limit": 500, "offset": 0}'
```

Increment `offset` by 500 until you've fetched all rows (check the `total` field in the first response). Collect every `(item, count)` pair.

### 2. Run the built-in duplicate detector

```bash
pnpm site:tools:call items.findDuplicates --input '{}'
```

This catches **case-only** differences. It does NOT catch abbreviations, missing hyphens, extra words, or typos — you must find those manually.

### 3. Identify duplicate groups manually

Compare the full item list for patterns like:

| Pattern                         | Example                                           |
| ------------------------------- | ------------------------------------------------- |
| Brand prefix added/removed      | `Apple AirPods Pro` vs `AirPods Pro`              |
| Abbreviation vs full name       | `Bose QC35` vs `Bose QuietComfort 35`             |
| Missing/extra hyphens or spaces | `Sennheiser HD25` vs `Sennheiser HD 25`           |
| Trailing descriptor             | `Sony WH-1000XM4 Headphones` vs `Sony WH-1000XM4` |
| Seller prefix                   | `Linsoul KZ ZS10 Pro` vs `KZ ZS10 Pro`            |
| Typos / transposed letters      | `Sony WF-1000MX5` vs `Sony WF-1000XM5`            |
| Case differences                | `BeyerDynamic` vs `Beyerdynamic`                  |

### 4. Present findings and ask for approval

Show the user a table of proposed merges with canonical name, variants, and user counts. **Do not merge without explicit approval.**

### 5. Merge via CLI

For each approved group:

```bash
pnpm site:tools:call items.merge --input '{"canonicalItem": "<CANONICAL>", "sourceItems": ["<VARIANT1>", "<VARIANT2>"]}'
```

- The canonical item is the most-used or most-correct spelling.
- Run up to 4 merge commands in parallel for speed.
- Every merge returns `affectedPeople`, `upsertedRows`, `deletedRows` — verify each succeeds (`"ok": true`).

### 6. Report results

Summarize: how many groups merged, total variants consolidated, total people affected.

## Choosing the canonical name

Pick the name that is:

1. **Most commonly used** (highest `count`)
2. **Officially correct** (matches the manufacturer's branding)
3. **Most specific** (e.g. `Bose QuietComfort 35 II` over `Bose QC35 II`)

When the most-used name conflicts with official branding, prefer official branding.

## Edge cases

- **Different product variants** (e.g. wired vs wireless, different generations): do NOT merge unless they are clearly the same product with different naming.
- **Ambiguous short names** (e.g. `Sennheiser` alone): leave as-is unless the user decides.
- **Cross-brand confusion** (e.g. `AKG ATH-M50` — AKG doesn't make this, Audio-Technica does): flag as a data error to the user.

## CLI reference

| Command                                                                                       | Description                      |
| --------------------------------------------------------------------------------------------- | -------------------------------- |
| `pnpm site:tools:call items.list --input '{"tag":"<TAG>","limit":500,"offset":0}'`            | List items by tag (paginate)     |
| `pnpm site:tools:call items.findDuplicates --input '{}'`                                      | Auto-detect case-only duplicates |
| `pnpm site:tools:call items.merge --input '{"canonicalItem":"<NAME>","sourceItems":["..."]}'` | Merge variants into canonical    |

Full CLI docs: `docs/site-management-toolkit.md`
