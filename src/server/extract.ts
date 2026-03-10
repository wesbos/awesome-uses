import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const ExtractedItem = z.object({
  item: z.string().describe('Product or tool name normalized to model level, e.g. "MacBook Pro", "VS Code", "Sony WH-1000XM4"'),
  tags: z.array(z.string()).describe('What kind of thing this is. e.g. ["editor"], ["keyboard"], ["computer"], ["productivity", "note-taking"]'),
  detail: z.string().nullable().describe('Specifics: size, year, specs, color. e.g. "16-inch, 2019, i9, 64GB RAM"'),
});

export const ExtractionResult = z.object({
  items: z.array(ExtractedItem),
});

export type ExtractedItemType = z.infer<typeof ExtractedItem>;
export type ExtractionResultType = z.infer<typeof ExtractionResult>;

// ---------------------------------------------------------------------------
// Extraction prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You extract tools, products, and gear from developer /uses pages.

For each distinct item mentioned, return:
- item: the product/tool name, normalized to the MODEL level. Put specifics (size, year, specs, color) in the detail field instead.
  Examples of normalization:
    "MacBook Pro 16-inch (2019, i9, 64GB)" → item: "MacBook Pro", detail: "16-inch, 2019, i9, 64GB"
    "MacBook Air M2 13-inch" → item: "MacBook Air", detail: "M2, 13-inch"
    "iPhone 15 Pro Max 256GB" → item: "iPhone", detail: "15 Pro Max, 256GB"
    "Dell U2720Q 27-inch 4K" → item: "Dell U2720Q", detail: "27-inch, 4K"
    "Sony WH-1000XM4" → item: "Sony WH-1000XM4", detail: null (that IS the model name)
    "Visual Studio Code" → item: "VS Code", detail: null
    "Keychron K2 v2 Brown switches" → item: "Keychron K2", detail: "v2, Brown switches"

- tags: lowercase labels describing WHAT KIND OF THING this item is. Pick from this reference list when possible:
    editor: VS Code, Neovim, Sublime Text, Cursor, Vim, IntelliJ IDEA, WebStorm
    terminal: iTerm2, Warp, Ghostty, Alacritty, Hyper, Windows Terminal
    shell-tool: Oh My Zsh, tmux, Starship, zoxide, fzf, ripgrep, bat, eza
    browser: Chrome, Firefox, Arc, Safari, Brave, Edge
    keyboard: Keychron K2, HHKB, Apple Magic Keyboard, Moonlander
    mouse: Logitech MX Master 3, Magic Trackpad, Razer DeathAdder
    monitor: LG 27UK850, Dell U2720Q, Apple Studio Display, Samsung Odyssey
    headphones: Sony WH-1000XM4, AirPods Pro, AirPods Max, Bose QC45
    microphone: Blue Yeti, Shure SM7B, Rode NT-USB, Elgato Wave
    camera: Sony a6400, Logitech C920, Elgato Facecam
    computer: MacBook Pro, MacBook Air, iMac, Mac Mini, Mac Studio, ThinkPad, Dell XPS
    desk: IKEA Bekant, Uplift V2, Jarvis, Autonomous SmartDesk
    chair: Herman Miller Aeron, Steelcase Leap, Secretlab Titan
    phone: iPhone, Pixel, Samsung Galaxy
    tablet: iPad Pro, iPad Air, reMarkable
    stand: monitor arm, laptop stand, Rain Design mStand
    speaker: HomePod, Sonos, Audioengine
    audio-interface: Focusrite Scarlett 2i2, Universal Audio Apollo
    productivity: Notion, Todoist, 1Password, Raycast, Alfred, Obsidian, Bear, Trello, Things
    dev-tool: Docker, Git, Postman, ESLint, Prettier, Homebrew, npm, pnpm
    server: nginx, Apache, PM2, Caddy
    infrastructure: AWS, Kubernetes, Terraform, Ansible, DigitalOcean
    language: JavaScript, TypeScript, Python, Go, PHP, Rust, Ruby, Java, C#
    framework: React, Next.js, Laravel, Tailwind CSS, Vue, Svelte, Django, Rails
    database: PostgreSQL, MySQL, Redis, MongoDB, SQLite, Supabase
    hosting: Netlify, Vercel, Cloudflare, Heroku, Fly.io, Railway
    design: Figma, Sketch, Photoshop, Illustrator, Canva
    music: Spotify, Apple Music, YouTube Music, Tidal
    chat: Slack, Discord, Teams, Telegram
    font: Fira Code, JetBrains Mono, Cascadia Code, Operator Mono
    theme: Cobalt2, Dracula, One Dark, Catppuccin, Gruvbox
    extension: VS Code extensions, browser extensions, Neovim plugins
    gaming: Steam, Nintendo Switch, PlayStation, Xbox
    lighting: Elgato Key Light, BenQ ScreenBar, Philips Hue
    storage: external SSD, NAS, Synology, USB drive
    network: router, mesh WiFi, Ubiquiti, Eero
    power: UPS, charger, power strip, USB hub, dock
    bag: backpack, laptop bag, sleeve
    os: macOS, Windows, Linux, Ubuntu, Arch
    vpn: Mullvad, NordVPN, Tailscale, WireGuard
    other: anything that doesn't fit the above

  You may use multiple tags when appropriate (e.g. VS Code → ["editor"], Notion → ["productivity"], Docker → ["dev-tool", "server"]).
  Invent a new tag ONLY if nothing above fits. Keep it short and lowercase.

- detail: brief specifics from the page (size, year, model variant, specs, color), or null if none.

Rules:
- Only extract items the author actually uses, not items they mention in passing or recommend against.
- Do NOT extract raw specs as items (e.g. "64GB RAM", "AMD Ryzen 5 3600" are details of a computer, not standalone items).
- Do NOT use these as tags: "programming", "web", "utility", "apple", "mac", "wireless", "ergonomic", "mobile", "client", "graphics", "google". These describe context, not what the item IS.
- If the page has no extractable items, return an empty items array.`;

export const DEFAULT_EXTRACTION_MODEL = 'gpt-5-mini';

export function createOpenAIClient(): OpenAI {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
}

export async function extractItemsFromMarkdown(
  client: OpenAI,
  markdown: string,
  model = DEFAULT_EXTRACTION_MODEL,
): Promise<ExtractionResultType> {
  const trimmed = markdown.slice(0, 15_000);

  const completion = await client.chat.completions.parse({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: trimmed },
    ],
    response_format: zodResponseFormat(ExtractionResult, 'extraction'),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    return { items: [] };
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Item normalization (post-extraction cleanup)
// ---------------------------------------------------------------------------

const ITEM_NORMALIZATIONS: Record<string, string> = {
  'Visual Studio Code': 'VS Code',
  'Google Chrome': 'Chrome',
  'Mozilla Firefox': 'Firefox',
  'Firefox Developer Edition': 'Firefox',
  'Apple Watch': 'Apple Watch',
  'Magic Mouse': 'Apple Magic Mouse',
  'Magic Keyboard': 'Apple Magic Keyboard',
  'Magic Trackpad': 'Apple Magic Trackpad',
};

const MODEL_STRIP_PATTERNS: [RegExp, string][] = [
  [/^MacBook Pro\b.*$/i, 'MacBook Pro'],
  [/^MacBook Air\b.*$/i, 'MacBook Air'],
  [/^Mac Studio\b.*$/i, 'Mac Studio'],
  [/^Mac Mini\b.*$/i, 'Mac Mini'],
  [/^Mac Pro\b.*$/i, 'Mac Pro'],
  [/^iMac\b.*$/i, 'iMac'],
  [/^iPhone\b.*$/i, 'iPhone'],
  [/^iPad Pro\b.*$/i, 'iPad Pro'],
  [/^iPad Air\b.*$/i, 'iPad Air'],
  [/^iPad Mini\b.*$/i, 'iPad Mini'],
  [/^iPad\b.*$/i, 'iPad'],
  [/^AirPods Pro\b.*$/i, 'AirPods Pro'],
  [/^AirPods Max\b.*$/i, 'AirPods Max'],
  [/^AirPods\b.*$/i, 'AirPods'],
  [/^Apple AirPods Pro\b.*$/i, 'AirPods Pro'],
  [/^Apple AirPods Max\b.*$/i, 'AirPods Max'],
  [/^Apple AirPods\b.*$/i, 'AirPods'],
  [/^HomePod\b.*$/i, 'HomePod'],
  [/^Pixel\b.*$/i, 'Pixel'],
  [/^Samsung Galaxy\b.*$/i, 'Samsung Galaxy'],
  [/^Surface Laptop\b.*$/i, 'Surface Laptop'],
  [/^Surface Pro\b.*$/i, 'Surface Pro'],
];

const YEAR_GEN_PATTERN = /\s*\((?:\d{4}|(?:\d+(?:st|nd|rd|th)\s+generation))[^)]*\)\s*$/i;
const TRAILING_YEAR = /\s+\d{4}$/;

const CATEGORY_MERGES: Record<string, string | null> = {
  'note-taking': 'productivity',
  'note-app': 'productivity',
  'notes': 'productivity',
  'ide': 'editor',
  'code-editor': 'editor',
  'text-editor': 'editor',
  'cli': 'shell-tool',
  'shell': 'shell-tool',
  'pointing-device': 'mouse',
  'trackpad': 'mouse',
  'trackball': 'mouse',
  'webcam': 'camera',
  'earbuds': 'headphones',
  'display': 'monitor',
  'dock': 'power',
  'hub': 'power',
  'usb-hub': 'power',
  'password-manager': 'productivity',
  'launcher': 'productivity',
  'version-control': 'dev-tool',
  'package-manager': 'dev-tool',
  'testing': 'dev-tool',
  'linter': 'dev-tool',
  'formatter': 'dev-tool',
  'deployment': 'hosting',
  'cdn': 'hosting',
  'cloud': 'infrastructure',
  'messaging': 'chat',
  'communication': 'chat',
  'collaboration': 'chat',
  'video-call': 'chat',
  'stationery': 'office',
  'pen': 'office',
  'stylus': 'office',
  'programming': null,
  'web': null,
  'utility': null,
  'apple': null,
  'mac': null,
  'wireless': null,
  'ergonomic': null,
  'mobile': null,
  'client': null,
  'graphics': null,
  'google': null,
  'service': null,
  'config': null,
  'development': null,
  'frontend': null,
  'backend': null,
  'open-source': null,
  'linux': null,
  'windows': null,
  'macos': null,
  'mechanical': null,
  'noise-cancelling': null,
  '4k': null,
  'usb-c': null,
  'thunderbolt': null,
  'bluetooth': null,
};

export function normalizeItem(item: ExtractedItemType): ExtractedItemType {
  let name = item.item.trim();
  let detail = item.detail?.trim() || null;

  if (ITEM_NORMALIZATIONS[name]) {
    name = ITEM_NORMALIZATIONS[name];
  }

  for (const [pattern, replacement] of MODEL_STRIP_PATTERNS) {
    if (pattern.test(name)) {
      const stripped = name.replace(replacement, '').trim().replace(/^[,\s-]+|[,\s-]+$/g, '');
      if (stripped) {
        detail = detail ? `${stripped}, ${detail}` : stripped;
      }
      name = replacement;
      break;
    }
  }

  const yearMatch = name.match(YEAR_GEN_PATTERN);
  if (yearMatch) {
    const yearInfo = yearMatch[0].replace(/^\s*\(/, '').replace(/\)\s*$/, '').trim();
    name = name.replace(YEAR_GEN_PATTERN, '').trim();
    detail = detail ? `${yearInfo}, ${detail}` : yearInfo;
  }

  const trailingYear = name.match(TRAILING_YEAR);
  if (trailingYear) {
    const year = trailingYear[0].trim();
    name = name.replace(TRAILING_YEAR, '').trim();
    detail = detail ? `${year}, ${detail}` : year;
  }

  const tags = item.tags
    .map((c) => c.toLowerCase().trim())
    .map((c) => {
      if (c in CATEGORY_MERGES) return CATEGORY_MERGES[c];
      return c;
    })
    .filter((c): c is string => c !== null);

  const uniqueTags = [...new Set(tags)];

  return {
    item: name,
    tags: uniqueTags.length > 0 ? uniqueTags : ['other'],
    detail,
  };
}

export function normalizeItems(items: ExtractedItemType[]): ExtractedItemType[] {
  return items.map(normalizeItem);
}

// Banned tags used for extraction review quality checks
export const BANNED_TAGS = [
  'programming', 'web', 'utility', 'apple', 'mac', 'wireless',
  'ergonomic', 'mobile', 'client', 'graphics', 'google',
];
