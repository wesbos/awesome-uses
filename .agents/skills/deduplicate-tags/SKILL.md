---
name: deduplicate-tags
description: Find and merge duplicate or overlapping tags in the site database using the CLI. Use when the user asks to deduplicate, merge, clean up, or consolidate tags — e.g. plurals, hyphen vs space variants, or synonyms like "browser" and "web browser".
---

# Deduplicate Tags

Find duplicate, overlapping, or inconsistently named tags in the site database and merge them into canonical tags via the CLI.

## Prerequisites

- Working directory: the repo root (`/Users/wesbos/Dropbox/awesome-uses`)
- Dependencies installed (`pnpm install`)
- Local D1 SQLite database available (auto-resolved from `.wrangler/`)

## Workflow

### 1. List all tags

```bash
pnpm site:tools:call tags.list --input '{}'
```

Returns `{ total, rows: [{ tag, itemCount, personCount }] }` sorted by `itemCount` descending. No pagination needed — all rows are returned in one call.

### 2. Identify duplicate groups

Scan the full tag list for these patterns:

| Pattern | Example |
|---------|---------|
| Singular vs plural | `speaker` vs `speakers` |
| Hyphen vs space | `file-manager` vs `file manager` |
| Trailing "s" variant | `framework` vs `frameworks` |
| Synonym / alias | `os` vs `operating system` |
| Verbose variant | `email-client` vs `email client` vs `mail client` vs `mail` |
| Sub-type that should merge up | `mechanical keyboard` → `keyboard` |
| Noun vs gerund | `linter` vs `linting` |
| Compound overlap | `rss-reader` vs `rss reader` vs `feed-reader` vs `rss` |
| Abbreviation | `vcs` vs `version control` |

Group them into merge sets: one **target tag** and one or more **source tags**.

### 3. Choose the canonical (target) tag

Pick the tag that is:

1. **Most commonly used** (highest `itemCount` or `personCount`)
2. **Consistent with existing conventions** — prefer the hyphenated slug form used by the majority of tags (e.g. `email-client` over `email client`)
3. **Concise but clear** (e.g. `os` over `operating system`, `browser` over `web browser`)

### 4. Present findings and ask for approval

Show the user a table of proposed merges:

| # | Canonical Tag | Source Tags | Rationale |
|---|---|---|---|
| 1 | `browser` | `browsers`, `web browser` | Plural + synonym |

**Do not merge without explicit approval.**

### 5. Merge via CLI

For each approved group:

```bash
pnpm site:tools:call tags.merge --input '{"targetTag": "<TARGET>", "sourceTags": ["<SRC1>", "<SRC2>"]}'
```

- Run up to 4 merge commands in parallel for speed.
- Every merge returns `{ targetTag, sourceTags, updatedRows, mergedRefs }` — verify each succeeds (`"ok": true`).

### 6. Report results

Summarize: how many groups merged, total source tags eliminated, total rows updated, total refs merged.

### 7. Optional: run again

After the first pass, re-list tags and look for second-order duplicates that only become visible once the first batch is consolidated (e.g. `developer tool` and `development tools` may both still exist after merging other variants).

## Edge cases

- **Genuinely distinct sub-types**: Do NOT merge tags that represent meaningfully different categories even if names are similar. For example, `browser extension` and `vs code extension` are specific sub-types of `extension` — only merge if the user explicitly approves.
- **Ambiguous overlap**: When two tags partially overlap (e.g. `music` vs `music streaming`), leave them separate unless the user decides.
- **Very low-count tags** (1 item, 1 person): These are often one-off tags from a single person's page. They are good merge candidates but verify they actually match the target concept.
- **"other" tag**: Never merge anything into or out of the `other` tag — it is a catch-all.

## CLI reference

| Command | Description |
|---------|-------------|
| `pnpm site:tools:call tags.list --input '{}'` | List all tags with item/person counts |
| `pnpm site:tools:call tags.get --input '{"tag":"<TAG>"}'` | Get detail for one tag (items, people) |
| `pnpm site:tools:call tags.merge --input '{"targetTag":"<T>","sourceTags":["..."]}'` | Merge source tags into target |
| `pnpm site:tools:call tags.rename --input '{"fromTag":"<OLD>","toTag":"<NEW>"}'` | Rename a single tag |
| `pnpm site:tools:call tags.deleteOrReplace --input '{"tag":"<TAG>","replacementTag":"<REP>"}'` | Delete tag, optionally replacing it |

Full CLI docs: `docs/site-management-toolkit.md`
