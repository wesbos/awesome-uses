---
name: normalize-tags
description: Normalize and canonicalize tag names in src/data.js using AI-assisted semantic matching, then update src/generated/tag-aliases.json.
---

# Normalize Tags Skill

Use this skill when tag variants in `src/data.js` have drifted (e.g. `Tailwind`, `TailwindCSS`, `REact`, `React.js`) and you want a canonical tag vocabulary.

## Objectives

1. Build/refresh a canonical tag list.
2. Map variant spellings/casings/synonyms to canonical names.
3. Update `src/generated/tag-aliases.json`.
4. Avoid destructive rewrites of `src/data.js` unless explicitly requested.

## Workflow

1. Read tags from `src/data.js`.
2. Cluster semantically equivalent tags (AI judgement first, regex second).
3. Choose one canonical form per cluster:
   - prefer ecosystem-standard names (`React`, `Next.js`, `Tailwind CSS`, `Node.js`),
   - preserve punctuation where meaningful (`Node.js`, `Vue.js`).
4. Write/update `src/generated/tag-aliases.json`:
   - keys: normalized alias tokens (lowercased, punctuation stripped),
   - values: canonical tag names.
5. Optionally run `npm run generate:tag-metadata` to regenerate grouped metadata.

## Canonicalization Rules

- Preserve known brand casing: `GitHub`, `TypeScript`, `JavaScript`.
- Prefer space-separated concepts: `Front End`, `Back End`, `Full Stack`.
- Collapse dot/js variants to ecosystem canonical (`React.js` -> `React`, `NextJS` -> `Next.js`).
- Do not silently merge unrelated tags with similar spelling.

## Output Requirements

- Commit updates to:
  - `src/generated/tag-aliases.json`
- Include a short note on:
  - number of alias keys,
  - major canonical clusters added/changed.
