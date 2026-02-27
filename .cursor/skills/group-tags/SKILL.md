---
name: group-tags
description: Group related canonical tags into higher-level topic buckets and write static metadata to src/generated/tag-groups.json.
---

# Group Tags Skill

Use this skill to create or refresh tag taxonomies used for browsing and analytics.

## Objectives

1. Read canonical tag vocabulary (from app data + alias map).
2. Group tags into meaningful high-level categories.
3. Emit deterministic static metadata in `src/generated/tag-groups.json`.

## Workflow

1. Collect canonical tags:
   - from app tag index logic and/or `src/generated/tag-aliases.json` values.
2. Create groups that improve discoverability (examples: Front-end, Back-end, Tooling, Career, Cloud).
3. Ensure each group object has:
   - `slug`
   - `name`
   - `tags` (sorted, unique)
4. Validate no duplicate tags across groups unless intentionally shared.
5. Write `src/generated/tag-groups.json`.

## Quality Bar

- Group names should be understandable to developers.
- Prefer fewer coherent groups over many tiny groups.
- Keep output deterministic and stable (sorted tags).
- Avoid overfitting to one-off tags with count=1 unless strategically useful.

## Optional Follow-up

- Run `npm run generate:tag-metadata` for regeneration checks.
- If significant regrouping occurred, verify tag permalink pages still resolve correctly.
