import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

export const ExtractedItem = z.object({
  item: z.string().describe('Product or tool name normalized to model level, e.g. "MacBook Pro", "VS Code", "Sony WH-1000XM4"'),
  categories: z.array(z.string()).describe('What kind of thing this is. e.g. ["editor"], ["keyboard"], ["computer"], ["productivity", "note-taking"]'),
  detail: z.string().nullable().describe('Specifics: size, year, specs, color. e.g. "16-inch, 2019, i9, 64GB RAM"'),
});

export const ExtractionResult = z.object({
  items: z.array(ExtractedItem),
});

export type ExtractedItemType = z.infer<typeof ExtractedItem>;
export type ExtractionResultType = z.infer<typeof ExtractionResult>;

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

- categories: lowercase labels describing WHAT KIND OF THING this item is. Pick from this reference list when possible:
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

  You may use multiple categories when appropriate (e.g. VS Code → ["editor"], Notion → ["productivity"], Docker → ["dev-tool", "server"]).
  Invent a new category ONLY if nothing above fits. Keep it short and lowercase.

- detail: brief specifics from the page (size, year, model variant, specs, color), or null if none.

Rules:
- Only extract items the author actually uses, not items they mention in passing or recommend against.
- Do NOT extract raw specs as items (e.g. "64GB RAM", "AMD Ryzen 5 3600" are details of a computer, not standalone items).
- Do NOT use these as categories: "programming", "web", "utility", "apple", "mac", "wireless", "ergonomic", "mobile", "client", "graphics", "google". These describe context, not what the item IS.
- If the page has no extractable items, return an empty items array.`;

function loadCanonicalTags(): string[] | null {
  const tagsPath = path.resolve(process.cwd(), 'src/generated/item-tags.json');
  if (!existsSync(tagsPath)) return null;
  try {
    const data = JSON.parse(readFileSync(tagsPath, 'utf8'));
    return Array.isArray(data.categories) ? data.categories : null;
  } catch {
    return null;
  }
}

function buildSystemPrompt(): string {
  const categories = loadCanonicalTags();
  if (!categories) return SYSTEM_PROMPT;

  return `${SYSTEM_PROMPT}

PREFERRED CATEGORIES: ${JSON.stringify(categories)}
Use these when they fit. You may create a new category if none of these apply, but prefer existing ones.`;
}

export const DEFAULT_MODEL = 'gpt-5-mini';

export function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  return new OpenAI({ apiKey });
}

export async function extractItemsFromMarkdown(
  client: OpenAI,
  markdown: string,
  model = DEFAULT_MODEL
): Promise<ExtractionResultType> {
  const trimmed = markdown.slice(0, 15_000);

  const completion = await client.chat.completions.parse({
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
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
