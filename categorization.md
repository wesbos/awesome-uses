# AI Item Extraction & Tagging

Scraped /uses pages are processed with an LLM (`gpt-5-mini`) to extract structured data per item. Results go into the `person_items` D1 table.

Requires `OPENAI_API_KEY` in `.env`.

## Data Shape

Each extracted item has three fields:

- **item** — product/tool name normalized to the *model level* (specifics go in `detail`)
- **tags** — lowercase labels describing *what kind of thing* this is (an item can have multiple)
- **detail** — optional specifics: size, year, specs, color, variant

## Item Normalization Rules

Item names are normalized to the model level. Specifics (year, size, specs) are moved to `detail`.

| Raw input | item | detail |
|---|---|---|
| MacBook Pro 16-inch (2019, i9, 64GB) | MacBook Pro | 16-inch, 2019, i9, 64GB |
| MacBook Air M2 13-inch | MacBook Air | M2, 13-inch |
| iPhone 15 Pro Max 256GB | iPhone | 15 Pro Max, 256GB |
| Dell U2720Q 27-inch 4K | Dell U2720Q | 27-inch, 4K |
| Sony WH-1000XM4 | Sony WH-1000XM4 | null (that IS the model) |
| Visual Studio Code | VS Code | null |
| Keychron K2 v2 Brown switches | Keychron K2 | v2, Brown switches |

Post-LLM normalization in `scripts/lib/normalize-items.ts` handles:

- **Direct renames**: Visual Studio Code -> VS Code, Google Chrome -> Chrome, Magic Mouse -> Apple Magic Mouse, etc.
- **Model stripping**: MacBook Pro 16-inch 2019 -> MacBook Pro (extras -> detail). Covers MacBook, iPhone, iPad, AirPods, HomePod, Pixel, Samsung Galaxy, Surface variants.
- **Year/generation suffixes**: "(2019)" or trailing "2019" stripped from name -> detail.

## Tag Reference List

The LLM picks from these tags. Multiple tags per item are allowed when appropriate.

| Tag | Examples |
|---|---|
| editor | VS Code, Neovim, Sublime Text, Cursor, Vim, IntelliJ IDEA, WebStorm |
| terminal | iTerm2, Warp, Ghostty, Alacritty, Hyper, Windows Terminal |
| shell-tool | Oh My Zsh, tmux, Starship, zoxide, fzf, ripgrep, bat, eza |
| browser | Chrome, Firefox, Arc, Safari, Brave, Edge |
| keyboard | Keychron K2, HHKB, Apple Magic Keyboard, Moonlander |
| mouse | Logitech MX Master 3, Magic Trackpad, Razer DeathAdder |
| monitor | LG 27UK850, Dell U2720Q, Apple Studio Display |
| headphones | Sony WH-1000XM4, AirPods Pro, AirPods Max, Bose QC45 |
| microphone | Blue Yeti, Shure SM7B, Rode NT-USB, Elgato Wave |
| camera | Sony a6400, Logitech C920, Elgato Facecam |
| computer | MacBook Pro, MacBook Air, iMac, Mac Mini, Mac Studio, ThinkPad, Dell XPS |
| desk | IKEA Bekant, Uplift V2, Jarvis, Autonomous SmartDesk |
| chair | Herman Miller Aeron, Steelcase Leap, Secretlab Titan |
| phone | iPhone, Pixel, Samsung Galaxy |
| tablet | iPad Pro, iPad Air, reMarkable |
| stand | monitor arm, laptop stand, Rain Design mStand |
| speaker | HomePod, Sonos, Audioengine |
| audio-interface | Focusrite Scarlett 2i2, Universal Audio Apollo |
| productivity | Notion, Todoist, 1Password, Raycast, Alfred, Obsidian, Bear, Trello, Things |
| dev-tool | Docker, Git, Postman, ESLint, Prettier, Homebrew, npm, pnpm |
| server | nginx, Apache, PM2, Caddy |
| infrastructure | AWS, Kubernetes, Terraform, Ansible, DigitalOcean |
| language | JavaScript, TypeScript, Python, Go, PHP, Rust, Ruby, Java, C# |
| framework | React, Next.js, Laravel, Tailwind CSS, Vue, Svelte, Django, Rails |
| database | PostgreSQL, MySQL, Redis, MongoDB, SQLite, Supabase |
| hosting | Netlify, Vercel, Cloudflare, Heroku, Fly.io, Railway |
| design | Figma, Sketch, Photoshop, Illustrator, Canva |
| music | Spotify, Apple Music, YouTube Music, Tidal |
| chat | Slack, Discord, Teams, Telegram |
| font | Fira Code, JetBrains Mono, Cascadia Code, Operator Mono |
| theme | Cobalt2, Dracula, One Dark, Catppuccin, Gruvbox |
| extension | VS Code extensions, browser extensions, Neovim plugins |
| gaming | Steam, Nintendo Switch, PlayStation, Xbox |
| lighting | Elgato Key Light, BenQ ScreenBar, Philips Hue |
| storage | external SSD, NAS, Synology, USB drive |
| network | router, mesh WiFi, Ubiquiti, Eero |
| power | UPS, charger, power strip, USB hub, dock |
| bag | backpack, laptop bag, sleeve |
| os | macOS, Windows, Linux, Ubuntu, Arch |
| vpn | Mullvad, NordVPN, Tailscale, WireGuard |
| other | anything that doesn't fit the above |

New tags can be invented if nothing fits, but existing ones are strongly preferred.

## Banned Tags

These describe *context* or *attributes*, not what an item is. They are stripped during post-processing:

`programming`, `web`, `utility`, `apple`, `mac`, `wireless`, `ergonomic`, `mobile`, `client`, `graphics`, `google`, `service`, `config`, `development`, `frontend`, `backend`, `open-source`, `linux`, `windows`, `macos`, `mechanical`, `noise-cancelling`, `4k`, `usb-c`, `thunderbolt`, `bluetooth`

## Tag Merges

Synonyms and aliases are merged during post-processing:

| Alias | Merged into |
|---|---|
| note-taking, note-app, notes | productivity |
| ide, code-editor, text-editor | editor |
| cli, shell | shell-tool |
| pointing-device, trackpad, trackball | mouse |
| webcam | camera |
| earbuds | headphones |
| display | monitor |
| dock, hub, usb-hub | power |
| password-manager, launcher | productivity |
| version-control, package-manager, testing, linter, formatter | dev-tool |
| deployment, cdn | hosting |
| cloud | infrastructure |
| messaging, communication, collaboration, video-call | chat |
| stationery, pen, stylus | office |

## Commands

```bash
# Extract: run LLM on all pages, write to person_items D1 table
pnpm extract                                    # skip already-extracted
pnpm extract -- --person wes-bos --force        # re-extract one person
pnpm extract -- --limit 100 --concurrency 10    # batch with concurrency
pnpm extract -- --force                         # re-extract everything

# Review: dump tag/item summary for human review
pnpm review

# Reclassify: review items in a tag and move them via LLM
pnpm reclassify                                 # dry run, "other" tag, 2+ users
pnpm reclassify -- --limit 10                   # test with 10 items
pnpm reclassify -- --apply                      # apply changes to D1
pnpm reclassify -- --tag extension --min 3      # target a different tag
pnpm reclassify -- --prompt "Are any of these actually frameworks or languages?"

# Merge case-duplicates: combine "CalDigit" + "Caldigit", "Logitech BRIO" + "Logitech Brio", etc.
pnpm merge-dupes                                # dry run — shows what would merge
pnpm merge-dupes -- --apply                     # apply merges to D1
```

### Reclassify flags

| Flag | Default | Description |
|---|---|---|
| `--tag` | `other` | Which tag to review |
| `--min` | `2` | Minimum user count to include an item |
| `--limit` | all | Max items to send to the LLM |
| `--prompt` | (built-in) | Custom system prompt (`{tag}` is replaced) |
| `--model` | `gpt-5-mini` | LLM model |
| `--apply` | off | Actually write changes to D1 (without this, dry run) |

## Key Files

- `scripts/lib/ai.ts` — LLM system prompt, Zod schema, OpenAI client
- `scripts/lib/normalize-items.ts` — post-LLM normalization (name cleanup, tag merges, banned tag stripping)
- `scripts/extract-items.ts` — main extraction script (uses `p-limit` for concurrency, default 10)
- `scripts/reclassify.ts` — reclassify items from one tag into better ones via LLM
- `scripts/merge-duplicates.ts` — merge case-duplicate item names (e.g. "CalDigit" vs "Caldigit")
- `scripts/review-extraction.ts` — review script for checking extraction quality

---

## Item Galaxy (Embedding-based Clustering)

**Commit:** `6ec43c26` on `the-big-boy` — revert this commit to remove all item-galaxy work.

Vectorizes the top 1000 most popular items using OpenAI `text-embedding-3-small` (1536 dims), stores embeddings in D1 `item_vectors` table, and displays a clustered scatter plot at `/item-galaxy` using UMAP + K-means.

### How it works
- **UMAP** projects 1536-dim embeddings to 2D for the scatter plot layout
- **K-means** assigns items to clusters (toggle between clustering on full embeddings vs UMAP 2D positions)
- Tunable knobs via URL search params: clusters, neighbors, minDist, spread

### Known limitations
- Embeddings group by **brand/ecosystem** more than by **product type** — e.g. all Apple products cluster together rather than "all keyboards" grouping across brands
- Large "developer tools" bucket doesn't split languages from editors from frameworks without high cluster counts
- Both UMAP and K-means are non-deterministic (no fixed seed), so clusters differ on every load

### Alternative approaches to try
1. **More clusters** (30-50) to get finer splits within broad groups
2. **Hierarchical clustering** — broad pass first, then sub-cluster within each group
3. **Co-occurrence embeddings** — embed based on which items appear together on /uses pages instead of item metadata
4. **Tag-based grouping** — skip embeddings, group by existing tags (keyboard, headphone, editor, language)

### Item Galaxy files
- `db/migrations/0010_item_vectors.sql` — D1 table for cached embeddings
- `src/server/db/item-vectors.server.ts` — DB access layer (upsert, getAll, getCount, getSlugs)
- `src/server/fn/items.ts` — `$batchVectorizeItems`, `$getItemGalaxyData` server functions
- `src/routes/item-galaxy.tsx` — visualization page with D3 scatter plot
- `src/server/db/index.server.ts` — re-exports for item vector functions
