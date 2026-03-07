import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ITEMS_PATH = join(__dirname, '..', 'src', 'generated', 'items.ts');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SvglEntry = {
  id: number;
  title: string;
  category: string | string[];
  route: string | { light: string; dark: string };
  url: string;
};

type SimpleIconEntry = {
  title: string;
  hex: string;
  source: string;
  aliases?: { aka?: string[] };
};

type ItemEntry = { slug: string; name: string; tags: string[]; image: string | null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function siSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/\./g, 'dot')
    .replace(/&/g, 'and')
    .replace(/đ/g, 'd')
    .replace(/ħ/g, 'h')
    .replace(/ı/g, 'i')
    .replace(/ĸ/g, 'k')
    .replace(/ŀ/g, 'l')
    .replace(/ł/g, 'l')
    .replace(/ß/g, 'ss')
    .replace(/ŧ/g, 't')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function svglUrl(entry: SvglEntry): string {
  if (typeof entry.route === 'string') return entry.route;
  return entry.route.dark || entry.route.light;
}

function siCdnUrl(slug: string): string {
  return `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`;
}

// ---------------------------------------------------------------------------
// SVGL alias map: our item name -> SVGL title (for items that don't match by name)
// ---------------------------------------------------------------------------

const SVGL_ALIASES: Record<string, string> = {
  'VS Code': 'Visual Studio Code',
  'Visual Studio': 'Visual Studio',
  'Lightroom': 'Lightroom',
  'Raindrop': 'Raindrop.io',
  'Raindrop.io': 'Raindrop.io',
};

// ---------------------------------------------------------------------------
// Simple Icons alias map: our item name -> SI title
// (only for items where our name differs from the SI title)
// ---------------------------------------------------------------------------

const SI_ALIASES: Record<string, string> = {
  'Chrome': 'Google Chrome',
  'HTML': 'HTML5',
  'Fish': 'fish shell',
  'Oh My Zsh': 'Zsh',
  'oh-my-zsh': 'Zsh',
  'iTerm': 'iTerm2',
  'iTerm 2': 'iTerm2',
  'VLC': 'VLC media player',
  'Arc Browser': 'Arc',
  'React Native': 'React',
  'SvelteKit': 'Svelte',
  'GitHub Desktop': 'GitHub',
  'Docker Desktop': 'Docker',
  'Nix': 'NixOS',
  'SCSS': 'Sass',
  'Tailwind': 'Tailwind CSS',
  'ProtonMail': 'Proton Mail',
  'ProtonVPN': 'Proton VPN',
  'Postgres': 'PostgreSQL',
  'Mastodon': 'Mastodon',
  'Bluesky': 'Bluesky',
  'Chromium': 'Google Chrome',
  'Zen': 'Zen Browser',
  'Zen Browser': 'Zen Browser',
};

// ---------------------------------------------------------------------------
// Manual overrides: item name -> verified image URL
// Used for items that aren't in SVGL or SI, or where we want a specific image.
// Every URL here has been verified to return 200.
// ---------------------------------------------------------------------------

function buildManualOverrides(siSlugs: Set<string>, svglByTitle: Map<string, SvglEntry>): Record<string, string> {
  const si = (slug: string) => {
    if (!siSlugs.has(slug)) {
      console.warn(`  WARNING: SI slug "${slug}" not in catalog`);
      return null;
    }
    return siCdnUrl(slug);
  };

  const svgl = (title: string) => {
    const entry = svglByTitle.get(title.toLowerCase());
    if (!entry) {
      console.warn(`  WARNING: SVGL title "${title}" not found`);
      return null;
    }
    return svglUrl(entry);
  };

  const overrides: Record<string, string> = {};
  function add(name: string, url: string | null) {
    if (url) overrides[name] = url;
  }

  const fav = (domain: string) =>
    `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=128`;

  // Apple hardware — all use the Apple logo
  const apple = si('apple')!;
  for (const name of [
    'iPhone', 'iPad', 'iPad Pro', 'iPad Air', 'iPad Mini',
    'MacBook Pro', 'MacBook Air', 'MacBook', 'Mac Mini', 'Mac Studio', 'iMac', 'Mac',
    'Apple Watch', 'Apple Watch Ultra', 'Apple Watch SE', 'Apple Pencil', 'Apple Pencil Pro', 'Apple Pencil 2',
    'Apple Magic Keyboard', 'Apple Magic Trackpad', 'Apple Magic Mouse', 'Apple Magic Mouse 2', 'Apple Magic Trackpad 2', 'Magic Mouse 2',
    'Apple Keyboard', 'Apple Wireless Keyboard', 'Apple Studio Display', 'Apple Cinema Display', 'Apple Pro Display XDR',
    'Apple Trackpad', 'HomePod', 'Apple AirTag', 'AirTag',
    'AirPods', 'AirPods Pro', 'AirPods Max', 'Apple EarPods', 'Magic Trackpad 2',
  ]) add(name, apple);

  add('Apple TV 4K', si('appletv'));
  add('Apple Music', si('applemusic'));

  // Apple software — use Apple logo for native apps
  for (const name of [
    'Apple Notes', 'Apple Calendar', 'Apple Mail', 'Apple Reminders',
    'Apple Books', 'Apple Photos', 'Keynote', 'GarageBand',
    'Logic Pro', 'Logic Pro X', 'Time Machine', 'Reminders',
    'Notes', 'Mail', 'Mail.app', 'Terminal', 'Terminal.app', 'Apple Terminal', 'macOS Terminal', 'Procreate',
    'Fantastical', 'Bear', 'Transmit', 'Pixelmator Pro', 'Pixelmator',
    'IINA', 'Infuse', 'CleanMyMac', 'CleanMyMac X', 'AppCleaner',
    'The Unarchiver', 'Keka', 'Dato', 'Itsycal',
    'Maccy', 'Paste', 'Vanilla', 'Hidden Bar',
    'Bartender', 'Ice', 'AltTab', 'Amphetamine', 'Caffeine',
    'Hazel', 'Keyboard Maestro', 'Little Snitch', 'LuLu',
    'Sip', 'BetterDisplay', 'iStat Menus', 'Numi',
    'Gifski', 'ScreenFlow', 'Screen Studio', 'Audio Hijack',
    'Loopback', 'Shottr', 'Kap', 'Spectacle',
    'BetterTouchTool', 'Karabiner-Elements', 'Karabiner Elements', 'Karabiner',
    'Magnet', 'GoodNotes', 'Craft', 'Airmail', 'Mimestream',
    'Tuple', 'Nova', 'Shortcuts', 'Apple Shortcuts', 'Apple Contacts', 'Apple Passwords',
    'Calendar', 'Apple Home', 'Apple Numbers', 'Apple Pages', 'Numbers', 'Pages',
    'Apple One', 'Apple Health', 'iCloud Drive', 'iWork',
    'Final Cut Pro', 'Final Cut Pro X', 'iMovie',
    'Finder', 'Preview', 'QuickTime Player', 'Handmirror', 'Hand Mirror',
    'BetterSnapTool', 'Moom', 'SelfControl', 'Flycut', 'CopyClip',
    'DaisyDisk', 'coconutBattery', 'MonitorControl', 'Lunar',
    'MindNode', 'Day One', 'Drafts', 'OmniFocus',
    'TextExpander', 'Marked 2', 'MacDown', 'BBEdit', 'CotEditor', 'TextMate', 'MacVim',
    'PDF Expert', 'Notability', 'Timing', 'Focus', 'Time Out',
    'Soulver', 'Paletro', 'Velja', 'Choosy', 'Hyperkey',
    'KeyCastr', 'KeyClu', 'Klack', 'noTunes', 'HazeOver',
    'Gifox', 'PixelSnap 2', 'ColorSnapper 2', 'System Color Picker',
    'SwitchResX', 'DisplayFusion Pro', 'Pandan', 'Presentify',
    'Quitter', 'One Thing', 'MenuMeters', 'Stats',
    'Dozer', 'Prompt', 'Actions', 'Cron', 'Notion Calendar',
    'Cardhop', 'BusyCal', 'Timery', 'Streaks', 'Sunsama',
    'Canary Mail', 'Spark Mail', 'Mailspring', 'Postbox', 'Mailbox',
    'Working Copy', 'Darkroom', 'Photomator', 'Capture One',
    'Acorn', 'Image2Icon', 'Pika', 'Giphy Capture',
    'GoodLinks', 'Readwise Reader', 'Unread', 'Reeder',
    'ForkLift', 'Commander One', 'Marta',
    'CapCut', 'TextSniper', 'Wispr Flow', 'Superwhisper',
    'aText', 'rcmd', 'Pearcleaner', 'MacUpdater',
    'AlDente', 'TG Pro', 'iA Presenter', 'iA Writer',
    'Strongbox', 'Scanner Pro', 'VueScan',
    'Screens', 'ScriptKit', 'Yoink', 'Mos',
  ]) add(name, apple);

  add('SF Mono', apple);
  add('Menlo', apple);

  // Google / Pixel
  const google = si('google')!;
  add('Pixel', google);
  add('Google Pixel', google);
  add('Google Pixel 8', google);
  add('Google Pixel Watch', google);
  add('Google Pixel Buds Pro', google);
  add('Google Workspace', google);
  add('Google Suite', google);
  add('G Suite', google);
  add('GSuite', google);
  add('Squoosh', google);
  add('Google One', google);
  add('Google Contacts', google);
  add('Google Domains', google);
  add('Google Home Mini', google);
  add('Google Nest Mini', google);
  add('Google Nest Hub', google);
  add('Google Hangouts', google);
  add('Google Podcasts', google);
  add('Google Play Books', google);
  add('Google Tag Assistant', google);
  add('Google Cloud Platform', google);
  add('GCP', google);
  add('Gboard', google);

  add('Chrome', si('googlechrome'));
  add('Chrome DevTools', si('googlechrome'));
  add('Chromium', si('googlechrome'));
  add('Ungoogled Chromium', si('googlechrome'));

  // Microsoft
  const windows = svgl('Windows');
  add('Windows', windows);
  add('Windows 10', windows);
  add('Windows 11', windows);
  add('Windows Terminal', windows);
  add('Microsoft Terminal', windows);
  add('Microsoft PowerToys', windows);
  add('Windows PowerToys', windows);
  add('WSL', windows);
  add('WSL2', windows);
  add('WSL 2', windows);
  add('Custom PC', windows);
  add('Desktop PC', windows);
  add('PC', windows);
  add('Custom built PC', windows);
  add('Custom desktop PC', windows);
  add('Custom-built PC', windows);
  add('Custom gaming PC', windows);
  add('Gaming PC', windows);
  add('Windows PC', windows);
  add('Custom build', windows);
  add('Custom desktop', windows);
  add('Desktop', windows);
  add('Oh My Posh', windows);
  add('Winget', windows);
  add('Scoop', windows);
  add('cmder', windows);
  add('Windows laptop', windows);
  add('Microsoft Edge', svgl('Edge'));
  add('Microsoft To Do', svgl('Microsoft Todo'));
  add('OneDrive', svgl('Microsoft OneDrive'));
  add('OneNote', svgl('Microsoft OneNote'));
  add('Office 365', svgl('Microsoft Office'));
  add('Microsoft 365', svgl('Microsoft Office'));
  add('Teams', svgl('Microsoft Teams'));
  add('Outlook', svgl('Microsoft Outlook'));
  add('Microsoft Sculpt Ergonomic Keyboard', svgl('Windows'));
  add('Xbox Series X', svgl('Xbox'));
  add('Xbox Series S', svgl('Xbox'));
  add('Xbox controller', svgl('Xbox'));

  // Samsung
  const samsung = si('samsung')!;
  add('Samsung Galaxy', samsung);
  add('Samsung Monitor', samsung);
  add('Samsung SSD', samsung);
  for (const name of [
    'Samsung 850 EVO', 'Samsung 860 EVO', 'Samsung 960 Evo', 'Samsung 970 EVO',
    'Samsung 970 Evo Plus', 'Samsung 970 Pro', 'Samsung 980 Pro', 'Samsung 990 Pro',
    'Samsung T5', 'Samsung T7',
    'Samsung C24F390', 'Samsung Odyssey G7', 'Samsung Odyssey G9', 'Samsung Odyssey G95T',
    'Samsung UHD', 'Samsung UR55',
  ]) add(name, samsung);

  // Sony
  const sony = si('sony')!;
  for (const name of [
    'Sony WH-1000XM3', 'Sony WH-1000XM4', 'Sony WH-1000XM5', 'Sony WH-1000XM6',
    'Sony WF-1000XM5', 'Sony WH-CH520', 'Sony WH-CH710N', 'Sony MDR-1000X',
    'Sony MDR-V6', 'Sony MDR7506', 'Sony ULT Wear',
    'Sony A7 III', 'Sony A7 IV', 'Sony a6400', 'Sony a6000', 'Sony a6100', 'Sony a5100',
    'Sony ZV-1', 'Sony ZV-E10', 'Sony FX30', 'Sony RX100 III', 'Sony NEX-6',
  ]) add(name, sony);
  add('PlayStation 5', si('playstation5'));
  add('PlayStation 4', si('playstation4'));
  add('PlayStation 4 Pro', si('playstation4'));
  add('PS5', si('playstation5'));

  // Nintendo — not in SI or SVGL, use favicon
  const nintendoFav = fav('nintendo.com');
  for (const name of [
    'Nintendo Switch', 'Nintendo Switch OLED', 'Nintendo Switch Pro Controller',
    'Nintendo 3DS', 'Game Boy',
  ]) add(name, nintendoFav);

  // Logitech
  const logitech = si('logitech')!;
  for (const name of [
    'Logitech MX Master 3', 'Logitech MX Master 3S', 'Logitech MX Master 2S',
    'Logitech MX Master', 'Logitech MX Master 4', 'Logitech MX Master 2',
    'Logitech MX Keys', 'Logitech MX Keys Mini', 'Logitech MX Keys S',
    'Logitech MX Vertical', 'Logitech MX Ergo',
    'Logitech MX Anywhere 2', 'Logitech MX Anywhere 3', 'Logitech MX Anywhere 3S',
    'Logitech MX Mechanical', 'Logitech MX Mechanical Mini', 'Logitech MX Palm Rest',
    'Logitech C920', 'Logitech C920s', 'Logitech C920x', 'Logitech C922', 'Logitech C922 Pro',
    'Logitech C925e', 'Logitech C930e', 'Logitech C270', 'Logitech Brio',
    'Logitech K380', 'Logitech K400', 'Logitech K400 Plus', 'Logitech K780',
    'Logitech G502', 'Logitech G502 Hero', 'Logitech G502 X', 'Logitech G502X',
    'Logitech G305', 'Logitech G304', 'Logitech G402', 'Logitech G403', 'Logitech G403 Hero',
    'Logitech G600', 'Logitech G603', 'Logitech G815',
    'Logitech G Pro X Superlight', 'Logitech G Pro Wireless',
    'Logitech M185', 'Logitech M500', 'Logitech M570', 'Logitech M585', 'Logitech M650',
    'Logitech M720 Triathlon', 'Logitech Signature M650',
    'Logitech Ergo K860', 'Logitech POP Keys',
    'Logitech StreamCam', 'Logitech Spotlight', 'Logitech Litra Glow',
    'Logitech Z200', 'Logitech Z333', 'Logitech Z623',
    'Logitech mouse', 'Logitech keyboard',
    'Logitech G432',
  ]) add(name, logitech);

  add('Blue Yeti', si('logitechg'));
  add('Blue Yeti X', si('logitechg'));
  add('Blue Yeti Nano', si('logitechg'));
  add('Blue Snowball', si('logitechg'));
  add('Blue Snowball iCE', si('logitechg'));
  add('Blue Compass', si('logitechg'));

  // Elgato
  const elgato = si('elgato')!;
  for (const name of [
    'Elgato Stream Deck', 'Elgato Stream Deck XL', 'Elgato Stream Deck MK.2',
    'Elgato Key Light', 'Elgato Key Light Air', 'Elgato Cam Link 4K', 'Elgato Cam Link',
    'Elgato Facecam', 'Elgato Wave XLR', 'Elgato Wave:3', 'Elgato Wave', 'Elgato Wave 3',
    'Elgato Wave Mic Arm', 'Elgato Wave Mic Arm LP', 'Elgato Wave Shock Mount',
    'Elgato Flex Arm', 'Elgato Multi Mount', 'Elgato Prompter',
  ]) add(name, elgato);

  // Dell
  const dell = si('dell')!;
  for (const name of [
    'Dell Latitude', 'Dell XPS 13', 'Dell XPS 15', 'Dell XPS', 'Dell U2720Q',
    'Dell monitor', 'Dell Ultrasharp', 'Dell Ultrasharp U2415',
    'Dell Precision', 'Dell Inspiron', 'Dell Inspiron 15', 'Dell G15',
    'Dell S2722QC', 'Dell P2415Q', 'Dell P2715Q', 'Dell P2719H', 'Dell P2721Q',
    'Dell U2415', 'Dell U2515H', 'Dell U2718Q', 'Dell U2719D', 'Dell U2722DE',
    'Dell U2723QE', 'Dell U3219Q', 'Dell U3417W', 'Dell U3818DW',
    'Dell UltraSharp U2715H', 'Dell P2418D', 'Dell PowerEdge R710',
    'Dell Optiplex', 'Dell laptop',
  ]) add(name, dell);

  // LG
  const lg = si('lg')!;
  for (const name of [
    'LG UltraFine', 'LG UltraFine 5K', 'LG monitor',
    'LG UltraGear', 'LG Ultrawide',
    'LG 27UK850', 'LG 27UD88-W', 'LG 27UL500-W', 'LG 27UL650',
    'LG 29UM69G', 'LG 29Wp60G', 'LG 27-inch',
  ]) add(name, lg);

  // Raspberry Pi
  const rpi = si('raspberrypi')!;
  for (const name of ['Raspberry Pi', 'Raspberry Pi 4', 'Raspberry Pi 4B', 'Raspberry Pi 5', 'Raspberry Pi 3B+']) {
    add(name, rpi);
  }

  // IKEA
  const ikea = si('ikea')!;
  for (const name of [
    'IKEA Bekant', 'Ikea Markus', 'IKEA Trotten', 'Ikea Gerton',
    'Ikea Alex', 'Ikea IDÅSEN', 'Ikea desk', 'IKEA Skarsta', 'IKEA UPPSPEL',
    'Ikea JÄRVFJÄLLET',
  ]) add(name, ikea);

  // Framework
  add('Framework Laptop', si('framework'));
  add('Framework 13', si('framework'));
  add('Framework Laptop 13', si('framework'));

  // Adobe
  const adobe = svgl('Adobe')!;
  add('Adobe Creative Cloud', adobe);
  add('Adobe Creative Suite', adobe);
  add('Adobe Photoshop', svgl('Photoshop'));
  add('Adobe Illustrator', svgl('Illustrator'));
  add('Adobe XD', svgl('XD'));
  add('Adobe After Effects', svgl('After Effects'));
  add('Adobe Lightroom', svgl('Lightroom'));
  add('Adobe Lightroom Classic', svgl('Lightroom'));
  add('Lightroom Classic', svgl('Lightroom'));
  add('Adobe Premiere Pro', svgl('Premiere'));
  add('Adobe Premiere', svgl('Premiere'));
  add('Adobe InDesign', svgl('InDesign'));
  add('Adobe Audition', adobe);

  // AI tools
  add('ChatGPT', si('openai'));
  add('Claude', si('claude'));
  add('Claude Code', si('claude'));
  add('Claude.ai', si('claude'));
  add('GitHub Copilot', si('githubcopilot'));
  add('GitHub Copilot Chat', si('githubcopilot'));
  add('Copilot', si('githubcopilot'));
  add('Gemini', si('googlegemini'));
  add('Codex', si('openai'));
  add('OpenAI APIs', si('openai'));
  add('Perplexity', si('perplexity'));
  add('Ollama', si('ollama'));
  add('Opencode', si('openai'));
  add('Mistral', svgl('Mistral AI'));
  add('Tabnine', fav('tabnine.com'));

  // Proton
  add('ProtonMail', si('protonmail'));
  add('Proton Mail', si('protonmail'));
  add('ProtonVPN', si('protonvpn'));
  add('Proton', si('proton'));

  // Browsers
  add('Arc', si('arc'));
  add('Arc Browser', si('arc'));
  add('Brave', si('brave'));
  add('Tor Browser', si('torbrowser'));
  add('Orion', si('safari'));
  add('Vivaldi', si('vivaldi'));

  // Terminals / shells
  const zsh = si('zsh')!;
  add('Oh My Zsh', zsh);
  add('oh-my-zsh', zsh);
  add('Powerlevel10k', zsh);
  add('Powerlevel9k', zsh);
  add('zsh-autosuggestions', zsh);
  add('zsh-syntax-highlighting', zsh);
  add('zsh4humans', zsh);
  add('zinit', zsh);
  add('z', zsh);
  add('z (zsh-z)', zsh);
  add('agnoster', zsh);
  add('pure', zsh);
  add('Spaceship Prompt', zsh);
  add('Fish', si('fishshell'));
  add('fisher', si('fishshell'));
  add('oh-my-fish', si('fishshell'));
  add('iTerm', si('iterm2'));
  add('iTerm 2', si('iterm2'));
  add('Git Bash', si('git'));
  add('Konsole', si('kde'));
  add('Kitty', 'https://sw.kovidgoyal.net/kitty/_static/kitty.svg');
  add('Terminator', si('gnometerminal'));
  add('gnome-terminal', si('gnometerminal'));
  add('Tilix', si('gnometerminal'));
  add('Xfce Terminal', si('xfce'));
  add('PuTTY', fav('putty.org'));
  add('MobaXterm', fav('mobaxterm.mobatek.net'));
  add('Termux', si('android'));
  add('Antigen', zsh);
  add('prezto', zsh);
  add('tmuxinator', si('tmux'));

  // Editors
  add('VS Code', svgl('Visual Studio Code'));
  add('Visual Studio', svgl('Visual Studio'));
  add('VS Codium', si('vscodium'));
  add('VSCodium', si('vscodium'));
  add('Cursor', svgl('Cursor'));
  add('Ghostty', svgl('Ghostty'));
  add('Eclipse', si('eclipseide'));
  add('Fleet', si('jetbrains'));
  add('JetBrains Toolbox', si('jetbrains'));
  add('Kate', si('kde'));
  add('Geany', si('linux'));
  add('NetBeans', si('apachenetbeanside'));
  add('RStudio', si('rstudioide'));
  add('RustRover', si('jetbrains'));
  add('Azure Data Studio', fav('azure.microsoft.com'));
  add('Arduino IDE', si('arduino'));
  add('micro', si('linux'));
  add('gedit', si('gnome'));
  add('Neovide', si('neovim'));

  // Frameworks / languages
  add('React Native', si('react'));
  add('React DevTools', si('react'));
  add('React Developer Tools', si('react'));
  add('React Testing Library', si('testinglibrary'));
  add('SvelteKit', si('svelte'));
  add('HTML', si('html5'));
  add('SCSS', si('sass'));
  add('Tailwind', si('tailwindcss'));
  add('TailwindCSS', si('tailwindcss'));
  add('Tailwind CSS IntelliSense', si('tailwindcss'));
  add('SQL', si('postgresql'));
  add('Postgres', si('postgresql'));
  add('Postgres.app', si('postgresql'));
  add('Alpine', si('alpinedotjs'));
  add('Alpine.js', si('alpinedotjs'));
  add('Framer Motion', si('framer'));
  add('Gatsby.js', si('gatsby'));
  add('.NET Core', si('dotnet'));
  add('ASP.NET', si('dotnet'));
  add('Node', si('nodedotjs'));
  add('NodeJS', si('nodedotjs'));
  add('ES6', si('javascript'));
  add('Processing', fav('processing.org'));
  add('Zustand', si('react'));
  add('NextJS', si('nextdotjs'));
  add('ExpressJS', si('express'));
  add('AngularJS', si('angular'));
  add('Inertia.js', si('inertia'));
  add('Rails', si('rubyonrails'));
  add('TanStack Query', si('reactquery'));

  // Dev tools
  const git = si('git')!;
  add('GitHub Desktop', si('github'));
  add('GitHub CLI', si('github'));
  add('gh', si('github'));
  add('GitLens', git);
  add('Git History', git);
  add('Git Graph', git);
  add('Git Blame', git);
  add('git-delta', git);
  add('lazygit', git);
  add('Fork', git);
  add('tig', git);
  add('gitignore', git);
  add('SVN', si('subversion'));
  add('Docker Desktop', si('docker'));
  add('Docker Compose', si('docker'));
  add('Docker Swarm', si('docker'));
  add('Dev Containers', si('docker'));
  add('lazydocker', si('docker'));
  add('MongoDB Compass', si('mongodb'));
  add('Redux DevTools', si('redux'));
  add('Redux Dev Tools', si('redux'));
  add('Nix', si('nixos'));
  add('NixOS', si('nixos'));
  add('nix-darwin', si('nixos'));
  add('home-manager', si('nixos'));
  add('Home Manager', si('nixos'));
  add('Sublime Merge', si('sublimetext'));
  add('RunJS', si('javascript'));
  add('Hammerspoon', si('lua'));
  add('MySQL Workbench', si('mysql'));
  add('HeidiSQL', si('mysql'));
  add('Chezmoi', si('linux'));
  add('dotfiles', si('linux'));
  add('OpenSSH', fav('openssh.com'));
  add('SSH', fav('openssh.com'));
  add('Storybook', si('storybook'));
  add('Homebrew Cask', si('homebrew'));
  add('Pandoc', si('markdown'));
  add('PHPUnit', si('php'));
  add('PestPHP', si('php'));
  add('PHP Monitor', si('php'));
  add('Homestead', si('laravel'));
  add('Local by Flywheel', si('wordpress'));
  add('LocalWP', si('wordpress'));
  add('WP-CLI', si('wordpress'));
  add('Postman Interceptor', si('postman'));
  add('Paw', fav('paw.cloud'));
  add('REST client', svgl('Visual Studio Code'));
  add('REST API', si('json'));
  add('Proxyman', si('swift'));
  add('GitLab CI', si('gitlab'));
  add('GitLab CI/CD', si('gitlab'));
  add('GitLab Pages', si('gitlab'));
  add('ArgoCD', si('argo'));
  add('Azure', fav('azure.microsoft.com'));
  add('Serverless Framework', si('serverless'));
  add('k9s', si('kubernetes'));
  add('kubectx', si('kubernetes'));
  add('microk8s', si('kubernetes'));
  add('Coolify', si('linux'));
  add('Traefik', si('traefikproxy'));
  add('DDEV', fav('ddev.com'));
  add('Lando', fav('lando.dev'));
  add('pyenv', si('python'));
  add('Pylance', si('python'));
  add('pyright', si('python'));
  add('pip', si('pypi'));
  add('pipenv', si('python'));
  add('black', si('python'));
  add('debugpy', si('python'));
  add('asdf', fav('asdf-vm.com'));
  add('npm-check-updates', si('npm'));
  add('npm (VS Code extension)', si('npm'));
  add('Graphviz', si('graphql'));
  add('JMeter', si('apachejmeter'));
  add('BrowserStack', fav('browserstack.com'));
  add('Robo 3T', si('mongodb'));
  add('WebPageTest', si('googlechrome'));
  add('CodeKit', si('javascript'));
  add('Valet', si('laravel'));
  add('MAMP Pro', si('mamp'));
  add('Responsively', si('googlechrome'));
  add('Responsively App', si('googlechrome'));
  add('ResponsivelyApp', si('googlechrome'));

  // VS Code extensions — use VS Code logo
  const vscode = svgl('Visual Studio Code')!;
  for (const name of [
    'Material Icon Theme', 'Material Theme', 'Error Lens', 'Live Server',
    'Live Share', 'Better Comments', 'Code Spell Checker',
    'Auto Rename Tag', 'Auto Close Tag', 'Import Cost',
    'Path Intellisense', 'Bracket Pair Colorizer', 'Bracket Pair Colorizer 2',
    'Markdown All in One', 'Settings Sync', 'One Dark Pro',
    'Cobalt2', 'Night Owl', 'Todo Tree', 'Color Highlight',
    'JSON Formatter', 'JSON Viewer', 'npm Intellisense',
    'PHP Intelephense', 'Thunder Client', 'Turbo Console Log',
    'Dracula Theme', 'Lorem Ipsum', 'Peacock', 'Pretty TypeScript Errors',
    'Project Manager', 'vscode-icons', 'markdownlint',
    'EditorConfig for VS Code', 'CodeSnap', 'Polacode',
    'TODO Highlight', 'indent-rainbow', 'Rainbow Brackets',
    'HTML CSS Support', 'CSS Peek', 'IntelliSense for CSS class names in HTML',
    'HTML end tag labels', 'Emmet', 'File Utils', 'Duplicate action',
    'Toggle Quotes', 'Change Case', 'Change Color Format',
    'Bookmarks', 'Front Matter', 'Markdown Preview Enhanced',
    'Rainbow CSV', 'Version Lens', 'Gutter Preview', 'Image Preview',
    'Highlight Matching Tag', 'Gremlins tracker', 'Even Better TOML',
    'Hex Editor', 'Excel Viewer', 'SVG Preview', 'Run on Save',
    'IntelliCode', 'Visual Studio IntelliCode',
    'Material Icons', 'Material Theme UI', 'Fluent Icons', 'Atom keymap',
    'Material Icons for GitHub', 'OctoLinker',
    'Expo Tools', 'GraphQL for VSCode', 'Live Sass Compiler',
    'SCSS Intellisense', 'vscode-styled-components', 'es6-string-html',
    'Quokka.js', 'REST client', 'Remote - SSH', 'Remote - Containers',
    'Remote Explorer', 'Minify', 'Beautify', 'Indenticator',
    'colorize', 'emojisense', 'open in browser',
    'VS Code extensions', 'Package Control',
    'PHP DocBlocker', 'intelephense', 'Better PHPUnit',
    'ShellCheck', 'hadolint', 'LTeX',
    'Notion Boost', 'Notion Web Clipper',
    'eslint-config-wesbos',
  ]) add(name, vscode);

  // Vim extensions
  const vim = si('vim')!;
  for (const name of [
    'vim-plug', 'vim-airline', 'vim-fugitive', 'vim-dispatch', 'vim-markdown',
    'typescript-vim', 'IdeaVim', 'Telescope', 'nvim-treesitter',
    'Dired', 'EMMS', 'mu4e', 'Org-mode',
  ]) add(name, vim);

  // Browser extensions — use browser logos
  const firefox = si('firefox')!;
  for (const name of [
    'Firefox Multi-Account Containers', 'Facebook Container',
    'Debugger for Firefox', 'Firefox Focus', 'Fennec',
  ]) add(name, firefox);

  const chrome = si('googlechrome')!;
  for (const name of [
    'Debugger for Chrome', 'axe', 'axe DevTools',
    'Accessibility Insights', 'Accessibility Insights for Web',
    'WhatFont', 'ColorPick Eyedropper', 'ColorZilla',
    'VisBug', 'PerfectPixel', 'Social Share Preview',
    'JSONVue', 'SingleFile', 'Bypass Paywalls',
    'ClearURLs', 'Clear URLs', 'Decentraleyes', 'Privacy Badger',
    'HTTPS Everywhere', 'DuckDuckGo Privacy Essentials',
    'I don\'t care about cookies', 'FastForward',
    'Enhancer for YouTube', 'Video Speed Controller', 'YouTube Auto HD',
    'Return YouTube Dislike', 'Unhook', 'SponsorBlock',
    'Reddit Enhancement Suite', 'Tab Suspender', 'Momentum',
    'Violentmonkey', 'Tridactyl', 'Vimium C',
    'Control Panel for Twitter', 'Simplified Twitter',
    'StreetPass for Mastodon', 'Picture-in-Picture',
    'Web Developer', 'webhint', 'Requestly',
    'Apollo Client Devtools', 'Vue Devtools', 'Vue.js devtools',
    'Vetur', 'Volar',
    'iCloud Passwords', 'Proton Pass', '1Blocker',
    'Awesome Cookie Manager', 'Awesome RSS', 'libredirect',
    'Forest', 'Notion Boost', 'Notion Web Clipper',
    'pass', 'floccus', 'Postman Interceptor',
    'OneTab',
  ]) add(name, chrome);

  add('Vimium', vim);
  add('Laravel Idea', si('laravel'));
  add('Laravel Docs', si('laravel'));
  add('ES7 React/Redux/GraphQL/React-Native snippets', si('react'));

  // Themes
  add('Gruvbox', vim);
  add('Nord', si('nordvpn'));
  add('Cobalt2 Theme', vscode);
  add('Cobalt 2', vscode);
  add('GitHub Theme', si('github'));
  add('GitHub Dark theme', si('github'));
  add('Night Owl theme', vscode);
  add('Shades of Purple', vscode);
  add('One Dark', vscode);
  add('Monokai Pro', vscode);
  add('Tokyo Night', vscode);
  add('Synthwave \'84', vscode);
  add('Solarized Light', vscode);
  add('Solarized Dark', vscode);
  add('Andromeda', vscode);
  add('Alloy', vscode);
  add('Vesper', vscode);
  add('Flexoki', vscode);
  add('Ayu Mirage', vscode);
  add('Panda Theme', vscode);
  add('Karma', vscode);
  add('Kanagawa', vscode);
  add('Rose Pine', vscode);
  add('Rosé Pine', vscode);
  add('New Moon', vscode);
  add('Plastic', vscode);
  add('Seti', vscode);
  add('Vitesse Theme', vscode);
  add('TeXt Theme', vscode);
  add('Yoncé', vscode);
  add('Dracula Pro', vscode);
  add('Iceberg', vscode);
  add('lucy', vscode);
  add('Antigravity', vscode);

  // Media
  add('VLC', si('vlcmediaplayer'));
  add('VLC Player', si('vlcmediaplayer'));
  add('DaVinci Resolve', si('davinciresolve'));
  add('DaVinci Resolve Studio', si('davinciresolve'));

  // Misc apps with verified SI slugs
  add('Lightroom', svgl('Lightroom'));
  add('Raindrop', svgl('Raindrop.io'));
  add('Raindrop.io', svgl('Raindrop.io'));
  add('Overcast', si('overcast'));
  add('Pocket Casts', si('pocketcasts'));
  add('PocketCasts', si('pocketcasts'));
  add('Mastodon', si('mastodon'));
  add('Ivory', si('mastodon'));
  add('Ivory for Mastodon', si('mastodon'));
  add('Moshidon', si('mastodon'));
  add('Elk', si('mastodon'));
  add('Goguma', si('mastodon'));
  add('Mona', si('mastodon'));
  add('Bluesky', si('bluesky'));
  add('Flameshot', si('linux'));
  add('Setapp', si('setapp'));
  add('KeePass', si('keepassxc'));
  add('KeePassDX', si('keepassxc'));
  add('Simplenote', si('simplenote'));
  add('Excalidraw', si('excalidraw'));
  add('f.lux', si('flux'));
  add('Synology NAS', si('synology'));
  for (const name of ['Synology DS218+', 'Synology DS918+', 'Synology DS920+', 'Synology DS923+', 'Synology DiskStation DS920+']) {
    add(name, si('synology'));
  }
  add('Calibre', si('calibreweb'));
  add('Spark', si('apachespark'));
  add('Zen', si('zenbrowser'));
  add('Zen Browser', si('zenbrowser'));
  add('Signal Desktop', si('signal'));
  add('Telegram', si('telegram'));
  add('Beeper', fav('beeper.com'));
  add('Ferdium', fav('ferdium.org'));
  add('Franz', fav('meetfranz.com'));
  add('Rambox', fav('rambox.app'));
  add('Facebook Messenger', si('messenger'));
  add('Standard Notes', fav('standardnotes.com'));
  add('Notesnook', fav('notesnook.com'));
  add('Plausible', si('plausibleanalytics'));
  add('Fathom Analytics', si('fathom'));
  add('GoatCounter', si('linux'));
  add('Hacker News', si('ycombinator'));
  add('Tweetbot', si('x'));

  // RSS readers
  const rss = si('rss')!;
  for (const name of ['Reeder', 'NetNewsWire', 'Feedbin', 'Miniflux', 'FreshRSS', 'newsboat', 'Capy Reader', 'Feeder']) {
    add(name, rss);
  }

  // Laravel ecosystem
  const laravel = si('laravel')!;
  add('Laravel Herd', laravel);
  add('Laravel Valet', laravel);
  add('Tinkerwell', laravel);
  add('Laravel Forge', laravel);
  add('Laravel Mix', laravel);

  // DB tools
  const mysql = si('mysql')!;
  add('Sequel Ace', mysql);
  add('Sequel Pro', mysql);
  add('DBngin', mysql);
  add('Oracle', fav('oracle.com'));
  add('Oracle Cloud', fav('oracle.com'));

  // Headphones (brand logos)
  const audiotechnica = si('audiotechnica')!;
  add('Audio-Technica ATH-M50x', audiotechnica);
  add('Audio-Technica AT2020', audiotechnica);
  add('Audio-Technica ATH-M20x', audiotechnica);
  add('Audio-Technica M50x', audiotechnica);

  const bose = si('bose')!;
  for (const name of [
    'Bose QuietComfort 35', 'Bose QC35 II', 'Bose QC35', 'Bose QuietComfort 35 II',
    'Bose Companion 2 Series III', 'Bose QuietComfort Ultra', 'Bose QuietComfort 45',
    'Bose QuietComfort 25', 'Bose 700', 'Bose Noise Cancelling Headphones 700',
    'Bose NC700', 'Bose QC 35 II', 'Bose QC25', 'Bose QC45',
    'Bose QuietComfort Ultra Earbuds', 'Bose Headphones 700',
    'Bose A20', 'Bose SoundLink Mini II',
  ]) add(name, bose);

  const sennheiser = si('sennheiser')!;
  for (const name of ['Sennheiser HD 6XX', 'Sennheiser HD 25', 'Sennheiser HD 599', 'Sennheiser Momentum']) {
    add(name, sennheiser);
  }

  add('Beyerdynamic DT 1990 Pro', fav('beyerdynamic.com'));
  add('beyerdynamic DT 990 Pro', fav('beyerdynamic.com'));
  add('Beyerdynamic DT 770 Pro', fav('beyerdynamic.com'));

  const steelseries = si('steelseries')!;
  for (const name of ['SteelSeries Arctis 7', 'SteelSeries Arctis Nova 7', 'SteelSeries QcK', 'Steelseries Rival 3']) {
    add(name, steelseries);
  }

  const hyperx = si('hyperx')!;
  for (const name of ['HyperX Cloud II', 'HyperX QuadCast', 'HyperX SoloCast', 'Kingston HyperX Fury']) {
    add(name, hyperx);
  }

  const razer = si('razer')!;
  for (const name of [
    'Razer Basilisk', 'Razer DeathAdder', 'Razer DeathAdder Elite',
    'Razer Kiyo', 'Razer BlackWidow', 'Roccat Kone Aimo',
  ]) add(name, razer);

  const corsair = si('corsair')!;
  for (const name of [
    'Corsair Vengeance LPX', 'Corsair Vengeance RGB Pro', 'Corsair Vengeance', 'Corsair Vengeance RGB',
    'Corsair K55', 'Corsair K70', 'Corsair T3 Rush', 'Corsair 4000D Airflow',
  ]) add(name, corsair);

  // Kindle
  const amazon = si('amazon')!;
  add('Kindle', amazon);
  add('Kindle Paperwhite', amazon);
  add('Kindle Oasis', amazon);
  add('Amazon Kindle', amazon);
  add('Amazon Kindle Paperwhite', amazon);
  add('AmazonBasics monitor arm', amazon);

  add('Steam Deck', si('steamdeck'));
  add('Steam Deck OLED', si('steamdeck'));
  add('Steam Controller', si('steam'));
  add('Stardew Valley', si('steam'));

  // Fonts — use a generic font icon (fontawesome exists in SI)
  const fontIcon = si('fontawesome')!;
  for (const name of [
    'Fira Code', 'JetBrains Mono', 'Cascadia Code', 'Inter',
    'Iosevka', 'Hack', 'Dank Mono', 'Operator Mono',
    'Victor Mono', 'MonoLisa', 'Berkeley Mono', 'Geist Mono',
    'IBM Plex Mono', 'Merriweather', 'Input', 'Input Mono', 'Meslo',
    'Monaspace', 'Monaspace Neon', 'Open Sans', 'Inconsolata',
    'Droid Sans Mono', 'Courier New', 'Cartograph', 'Nerd Fonts',
    'IBM Plex Sans', 'Playfair Display', 'Poppins', 'Space Mono',
    'Maple Mono', 'Terminus',
  ]) add(name, fontIcon);

  // Ubiquiti
  const ubiquiti = si('ubiquiti')!;
  for (const name of [
    'Ubiquiti Dream Machine Pro', 'Ubiquiti U6-LR', 'Ubiquiti UniFi',
    'Ubiquiti UniFi AC Pro', 'UniFi Dream Machine SE', 'Unifi',
  ]) add(name, ubiquiti);

  // Lenovo/ThinkPad
  const lenovo = si('lenovo')!;
  for (const name of [
    'Lenovo IdeaPad', 'Lenovo IdeaPad 5', 'Lenovo Ideapad 320',
    'Lenovo Legion 5', 'ThinkPad E14', 'ThinkPad T14', 'ThinkPad T14s',
    'ThinkPad T480', 'ThinkPad T460', 'ThinkPad T490', 'ThinkPad X1 Carbon',
    'Thinkpad T450s',
  ]) add(name, lenovo);

  // HP
  const hp = si('hp')!;
  for (const name of [
    'HP laptop', 'HP Pavilion x360', 'HP Victus', 'HP Deskjet',
    'HP EliteDisplay E232',
  ]) add(name, hp);

  // Asus
  const asus = si('asus')!;
  for (const name of ['Asus PB278', 'Asus Zenbook', 'Asus laptop']) {
    add(name, asus);
  }

  // Acer
  const acer = si('acer')!;
  for (const name of ['Acer monitor', 'Acer Nitro']) {
    add(name, acer);
  }

  // Microsoft Surface
  const surfaceFav = fav('microsoft.com');
  for (const name of ['Surface Laptop', 'Surface Pro']) {
    add(name, surfaceFav);
  }

  // Nikon
  const nikonFav = fav('nikon.com');
  for (const name of ['Nikon D3200', 'Nikon D7500', 'Nikon D780', 'Nikon F100', 'Nikon Z6']) {
    add(name, nikonFav);
  }

  // Canon
  const canonFav = fav('canon.com');
  for (const name of ['Canon 6D', 'Canon EOS 60D', 'Canon EOS R5', 'Canon RF 70-200mm f/2.8 L IS USM', 'Canon m200']) {
    add(name, canonFav);
  }

  // Fujifilm
  for (const name of [
    'Fujifilm X-T20', 'Fujifilm X-E4', 'Fujifilm X-T10', 'Fujifilm X-T4',
    'Fujifilm X100V', 'Fujifilm XF 16-80mm F4 R OIS WR',
  ]) add(name, si('fujifilm'));

  // Rode
  const rodeFav = fav('rode.com');
  for (const name of [
    'Rode PSA1', 'Rode NT-USB', 'Rode NT-USB Mini', 'Rode PodMic',
    'Rode Podcaster', 'RØDE PSA1', 'RØDE Procaster', 'Rode VideoMic Go II',
    'Røde NT-USB', 'RødeCaster Pro II',
  ]) add(name, rodeFav);

  // Shure
  const shureFav = fav('shure.com');
  for (const name of ['Shure SM7B', 'Shure MV7', 'Shure Beta 87A', 'Shure SE215', 'Shure SE215 Pro', 'Shure SM58']) {
    add(name, shureFav);
  }

  // Samson
  for (const name of ['Samson Q2U', 'Samson SR850']) {
    add(name, si('linux'));
  }

  // Seagate
  const seagate = si('seagate')!;
  for (const name of [
    'Seagate Barracuda', 'Seagate IronWolf', 'Seagate IronWolf Pro',
    'Seagate Expansion', 'Seagate FireCuda', 'Seagate external hard drive',
  ]) add(name, seagate);

  // WD
  for (const name of ['WD Blue', 'WD My Passport', 'WD Elements Portable', 'WD HDD', 'WD Red Plus']) {
    add(name, si('westerndigital'));
  }

  // SanDisk
  add('SanDisk Extreme Portable SSD', si('sandisk'));

  // Nvidia
  const nvidia = si('nvidia')!;
  for (const name of ['NVIDIA GeForce GTX', 'NVIDIA RTX', 'NVIDIA GeForce RTX']) {
    add(name, nvidia);
  }

  // AMD
  const amd = si('amd')!;
  for (const name of ['AMD Ryzen 5', 'AMD Ryzen 5 5600X', 'AMD Ryzen 7', 'AMD Ryzen 9 5900X', 'AMD Ryzen 9', 'AMD Ryzen 7 9800X3D']) {
    add(name, amd);
  }

  // Intel
  const intel = si('intel')!;
  for (const name of ['Intel NUC', 'Intel Core i5', 'Intel Core i7']) {
    add(name, intel);
  }

  // Linux distros
  add('Arch', si('archlinux'));
  add('Manjaro Linux', si('manjaro'));
  add('Ubuntu Server', si('ubuntu'));
  add('Fedora Workstation', si('fedora'));
  add('Elementary OS', si('elementary'));
  add('DietPi', si('linux'));
  add('Omarchy', si('linux'));
  add('Hackintosh', apple);

  // Cloudflare
  const cloudflare = si('cloudflare')!;
  add('cloudflared', cloudflare);
  add('Cloudflare R2', cloudflare);
  add('Cloudflare WARP', cloudflare);
  add('Bunny CDN', cloudflare);

  // Hetzner
  add('Hetzner Cloud', si('hetzner'));
  add('Linode', fav('linode.com'));
  add('Backblaze B2', si('backblaze'));
  add('Dreamhost', si('linux'));
  add('DNSimple', si('linux'));

  // Proton
  add('ProtonMail', si('protonmail'));
  add('Proton Mail', si('protonmail'));
  add('ProtonVPN', si('protonvpn'));
  add('Proton', si('proton'));
  add('Proton Pass', si('proton'));
  add('ProtonDrive', si('proton'));

  // Mozilla
  add('Mozilla Thunderbird', si('thunderbird'));
  add('Betterbird', si('thunderbird'));

  // Security
  add('YubiKey', si('yubico'));
  add('YubiKey 5C NFC', si('yubico'));
  add('VeraCrypt', fav('veracrypt.fr'));
  add('GnuPG', si('gnuprivacyguard'));
  add('GPG Suite', si('gnuprivacyguard'));

  // Misc gaming
  add('Minecraft', fav('minecraft.net'));
  add('Dolphin', si('linux'));
  add('PCSX2', si('linux'));
  add('Prism Launcher', si('linux'));
  add('OpenEmu', apple);
  add('Heroic Games Launcher', si('linux'));
  add('Oculus Rift S', si('meta'));
  add('Playdate', si('linux'));

  // Music
  add('Deezer', fav('deezer.com'));
  add('Reaper', fav('reaper.fm'));
  add('FL Studio', fav('image-line.com'));
  add('Ableton Live', fav('ableton.com'));
  add('Splice', fav('splice.com'));

  // Misc
  add('Wacom Intuos', fav('wacom.com'));
  add('Wacom Intuos Pro', fav('wacom.com'));
  add('reMarkable', fav('remarkable.com'));
  add('reMarkable 2', fav('remarkable.com'));
  add('Parallels', fav('parallels.com'));
  add('Parallels Desktop', fav('parallels.com'));
  add('UTM', fav('mac.getutm.app'));
  add('KDE Connect', si('kde'));
  add('Sketchybar', apple);

  // Remaining hardware items
  add('monitor', fav('dell.com'));
  add('monitor arm', fav('ergotron.com'));
  add('standing desk', fav('fully.com'));
  add('laptop stand', fav('therooststand.com'));
  add('mechanical keyboard', fav('keychron.com'));
  add('custom mechanical keyboard', fav('keychron.com'));
  add('office chair', fav('hermanmiller.com'));
  add('Ergonomic office chair', fav('hermanmiller.com'));
  add('Generic office chair', fav('hermanmiller.com'));
  add('Home Server', fav('synology.com'));
  add('Linux server', fav('ubuntu.com'));
  add('Laptop', fav('apple.com'));
  add('ring light', fav('elgato.com'));
  add('Audioengine A2+', fav('audioengineusa.com'));
  add('Edifier R1855DB', fav('edifier.com'));
  add('Edifier M60', fav('edifier.com'));
  add('PreSonus Eris E3.5', fav('presonus.com'));
  add('Jabra Speak 510', fav('jabra.com'));
  add('Cloudlifter CL-1', fav('cloudmicrophones.com'));
  add('dbx 286s', fav('dbxpro.com'));
  add('AIAIAI TMA-2', fav('aiaiai.audio'));
  add('AKG K240', fav('akg.com'));
  add('AKG K7XX', fav('akg.com'));
  add('Harman Kardon SoundSticks II', fav('harmankardon.com'));
  add('Kanto YU2', fav('kantoaudio.com'));
  add('Surface Pro', fav('microsoft.com'));
  add('Surface Laptop', fav('microsoft.com'));
  add('Desk', fav('fully.com'));
  add('desk', fav('fully.com'));
  add('Sit/Stand Desk', fav('fully.com'));
  add('Butcher block countertop', fav('ikea.com'));
  add('Costume Desk', fav('ikea.com'));
  add('Custom desk', fav('ikea.com'));
  add('InnoGear microphone arm', fav('amazon.com'));
  add('AmazonBasics monitor arm', fav('amazon.com'));
  add('Notebook', fav('moleskine.com'));
  add('Rhodia dotpad', fav('rhodiapads.com'));
  add('Aputure Amaran P60x', fav('aputure.com'));
  add('Neewer Parabolic Softbox', fav('neewer.com'));
  add('Arris SURFboard SB8200', fav('arris.com'));
  add('Netgear switch', fav('netgear.com'));
  add('urxvt', fav('archlinux.org'));
  add('st', fav('suckless.org'));
  add('foot', fav('codeberg.org'));
  add('1 Second Everyday', fav('1se.co'));
  add('7-Zip', fav('7-zip.org'));
  add('Aegis', fav('getaegis.com'));
  add('GitHub Codespaces', si('github'));
  add('Markor', fav('github.com'));
  add('Atom Material Icons', vscode);
  add('Dash to Dock', fav('extensions.gnome.org'));
  add('Rollerblade wheels', fav('rollerblade.com'));
  add('1Password CLI', si('1password'));
  add('asdf', fav('asdf-vm.com'));
  add('Bash Git Prompt', fav('github.com'));
  add('Battery Indicator', fav('github.com'));
  add('Mi Band 4', fav('mi.com'));
  add('MPC-HC', fav('github.com'));
  add('Motrix', fav('motrix.app'));
  add('OpenCore', fav('github.com'));
  add('Orca', fav('gnome.org'));
  add('PRS SE Custom 24', fav('prsguitars.com'));
  add('PipePipe', fav('github.com'));
  add('Port Manager', fav('github.com'));
  add('RDM', fav('github.com'));
  add('Rainbow', fav('github.com'));
  add('Sequel', fav('sequel.com'));
  add('Templater', fav('github.com'));
  add('TripMode', fav('tripmode.ch'));
  add('USB-C hub', fav('anker.com'));
  add('VoiceOver', apple);
  add('Voyager', fav('zsa.io'));
  add('mouse', fav('logitech.com'));
  add('Xbox controller', svgl('Xbox'));
  add('brotli', fav('github.com'));
  add('coffee', fav('aeropress.com'));
  add('fidget cube', fav('amazon.com'));
  add('iOS Camera', apple);
  add('iptables', fav('netfilter.org'));
  add('meld', fav('meldmerge.org'));
  add('pdf-tools', fav('github.com'));
  add('phpcs', si('php'));
  add('pen', fav('lamy.com'));
  add('pen and paper', fav('lamy.com'));
  add('sunglasses', fav('amazon.com'));
  add('sxiv', fav('github.com'));
  add('tabular', fav('github.com'));
  add('taskwarrior', fav('taskwarrior.org'));
  add('vinyl', fav('discogs.com'));
  add('water bottle', fav('hydroflask.com'));
  add('whiteboard', fav('amazon.com'));
  add('zathura', fav('github.com'));
  add('pull-up bar', fav('amazon.com'));
  add('rush', fav('github.com'));
  add('Kodak Portra 400', fav('kodak.com'));
  add('DS file', fav('synology.com'));
  add('Dictionary', apple);
  add('Email', fav('gmail.com'));
  add('Jetpack', fav('jetpack.com'));
  add('K-9 Mail', fav('k9mail.app'));
  add('Imprint CumulusPRO anti-fatigue mat', fav('amazon.com'));
  add('G.Skill Ripjaws', fav('gskill.com'));
  add('Gerber Shard', fav('gerbergear.com'));
  add('HEIC Converter', apple);
  add('Atomic Habits', fav('jamesclear.com'));
  add('AU Lab', apple);
  add('Adapter', fav('github.com'));
  add('Advanced Custom Fields', fav('advancedcustomfields.com'));
  add('Ryobi', fav('ryobi.com'));
  add('Libreboot', fav('libreboot.org'));
  add('Librera Reader', fav('github.com'));
  add('Lian Li O11 Dynamic Mini', fav('lian-li.com'));
  add('Fractal Design North', fav('fractal-design.com'));
  add('NZXT S340', fav('nzxt.com'));
  add('ASRock X570 Phantom Gaming 4', fav('asrock.com'));
  add('Corsair 4000D Airflow', fav('corsair.com'));
  add('Corsair Vengeance', fav('corsair.com'));
  add('Corsair Vengeance RGB', fav('corsair.com'));
  add('DaVinci Resolve Studio', fav('blackmagicdesign.com'));
  add('Elgato Stream Deck MK.2', fav('elgato.com'));
  add('Flipper', fav('github.com'));
  add('Fujitsu ScanSnap S1300i', fav('fujitsu.com'));
  add('Gboard', fav('google.com'));
  add('Glance', fav('github.com'));
  add('Heroic Games Launcher', fav('heroicgameslauncher.com'));
  add('Hyprlock', fav('github.com'));
  add('hypridle', fav('github.com'));
  add('IrfanView', fav('irfanview.com'));
  add('Logitech G432', fav('logitech.com'));
  add('Messages', apple);
  add('Microsoft Terminal', windows);
  add('Midnight Commander', fav('midnight-commander.org'));
  add('MonitorControl', apple);
  add('Neovide', fav('neovide.dev'));
  add('Oculus Rift S', fav('meta.com'));
  add('Playdate', fav('play.date'));
  add('PlayStation 4 Pro', fav('playstation.com'));
  add('Proxmox VE', fav('proxmox.com'));
  add('Samson Q2U', fav('samsontech.com'));
  add('Samson SR850', fav('samsontech.com'));
  add('SteelSeries QcK', fav('steelseries.com'));
  add('Storytel', fav('storytel.com'));
  add('YouTube Premium', fav('youtube.com'));
  add('Ultimaker Cura', fav('ultimaker.com'));
  add('WLED', fav('kno.wled.ge'));
  add('Amethyst', fav('ianyh.com'));
  add('Übersicht', fav('tracesof.net'));
  add('CrossOver', fav('codeweavers.com'));
  add('Tesla Model 3', fav('tesla.com'));

  // Focusrite
  const focusriteFav = fav('focusrite.com');
  for (const name of ['Focusrite Scarlett 2i2', 'Focusrite Scarlett Solo', 'Focusrite Scarlett 4i4', 'Focusrite Scarlett 2i4', 'Focusrite Vocaster One']) {
    add(name, focusriteFav);
  }

  // Herman Miller / chairs
  const hermanMillerFav = fav('hermanmiller.com');
  for (const name of ['Herman Miller Aeron', 'Herman Miller Mirra 2', 'Herman Miller Embody', 'Herman Miller Mirra', 'Herman Miller Sayl']) {
    add(name, hermanMillerFav);
  }

  // Plex
  add('Plex Media Server', si('plex'));
  add('Plexamp', si('plex'));

  // Misc hardware
  add('Flipper Zero', si('flipkart'));
  add('Tesla Model 3', si('tesla'));
  add('Sonos One', si('sonos'));
  add('Sonos Roam', si('sonos'));

  // Noctua
  add('Noctua NH-D15', fav('noctua.at'));

  // AdGuard
  add('AdGuard Home', si('adguard'));

  // Proxmox
  add('Proxmox VE', si('proxmox'));

  // Misc dev
  add('Godot', si('godotengine'));
  add('FigJam', si('figma'));
  add('Freeform', apple);
  add('Paint.NET', si('dotnet'));
  add('darktable', fav('darktable.org'));
  add('Shotcut', si('linux'));
  add('Vegas Pro', si('linux'));
  add('Descript', si('linux'));
  add('Camtasia', si('linux'));
  add('CapCut', si('linux'));

  // Notion
  add('Notion Calendar', si('notion'));

  // Linear
  add('LinearMouse', apple);
  add('Mac Mouse Fix', apple);

  // Tier 3: Additional favicon-based overrides
  const faviconItems: Record<string, string> = {
    'TablePlus': 'tableplus.com',
    'Rectangle': 'rectangleapp.com',
    'Rectangle Pro': 'rectangleapp.com',
    'CleanShot X': 'cleanshot.com',
    'CleanShot': 'cleanshot.com',
    'Things': 'culturedcode.com',
    'Things 3': 'culturedcode.com',
    'Fastmail': 'fastmail.com',
    'OrbStack': 'orbstack.dev',
    'Zellij': 'zellij.dev',
    'Polypane': 'polypane.app',
    'Catppuccin': 'catppuccin.com',
    'Dracula': 'draculatheme.com',
    'Cyberduck': 'cyberduck.io',
    'Typora': 'typora.io',
    'Readwise': 'readwise.io',
    'Readwise Reader': 'readwise.io',
    'YNAB': 'ynab.com',
    'You Need A Budget': 'ynab.com',
    'Espanso': 'espanso.org',
    'LocalSend': 'localsend.org',
    'Handbrake': 'handbrake.fr',
    'ImageOptim': 'imageoptim.com',
    'Zeplin': 'zeplin.io',
    'Keychron K2': 'keychron.com',
    'Keychron K3': 'keychron.com',
    'Keychron K6': 'keychron.com',
    'Keychron K8': 'keychron.com',
    'Keychron K10': 'keychron.com',
    'Keychron K1': 'keychron.com',
    'Keychron K4': 'keychron.com',
    'Keychron K7': 'keychron.com',
    'Keychron K8 Pro': 'keychron.com',
    'Keychron Q1': 'keychron.com',
    'Keychron Q1 Pro': 'keychron.com',
    'Keychron Q11': 'keychron.com',
    'Keychron V6': 'keychron.com',
    'Keychron M6': 'keychron.com',
    'Keychron MX Keys S': 'keychron.com',
    'NuPhy Air75': 'nuphy.com',
    'NuPhy Air60': 'nuphy.com',
    'Nuphy Air 75': 'nuphy.com',
    'Nuphy Air60': 'nuphy.com',
    'Nuphy Air96': 'nuphy.com',
    'nuphy Air96': 'nuphy.com',
    'Nuphy Kick75': 'nuphy.com',
    'ZSA Moonlander': 'zsa.io',
    'ZSA Voyager': 'zsa.io',
    'ErgoDox EZ': 'zsa.io',
    'Moonlander': 'zsa.io',
    'Ergodox Infinity': 'zsa.io',
    'Wave': 'waveterm.dev',
    'CalDigit TS4': 'caldigit.com',
    'CalDigit TS3 Plus': 'caldigit.com',
    'Oura Ring': 'ouraring.com',
    'BenQ ScreenBar Halo': 'benq.com',
    'BenQ': 'benq.com',
    'BenQ monitor': 'benq.com',
    'BenQ ScreenBar': 'benq.com',
    'BenQ RD320UA': 'benq.com',
    'Secretlab Titan': 'secretlab.co',
    'Secretlab TITAN Evo': 'secretlab.co',
    'Secretlab Magnus Pro': 'secretlab.co',
    'Nmap': 'nmap.org',
    'ImageMagick': 'imagemagick.org',
    'Lamy Safari': 'lamy.com',
    'Peak Design Everyday Backpack': 'peakdesign.com',
    'Peak Design Cuff': 'peakdesign.com',
    'Peak Design Everyday Case': 'peakdesign.com',
    'Steelcase Gesture': 'steelcase.com',
    'Steelcase Leap': 'steelcase.com',
    'SVGOMG': 'jakearchibald.github.io',
    'Uplift V2': 'upliftdesk.com',
    'Uplift Desk': 'upliftdesk.com',
    'atuin': 'atuin.sh',
    'mise': 'mise.jdx.dev',
    'yazi': 'yazi-rs.github.io',
    'yt-dlp': 'github.com',
    'youtube-dl': 'github.com',
    'fzf': 'github.com',
    'ripgrep': 'github.com',
    'fd': 'github.com',
    'fd-find': 'github.com',
    'jq': 'jqlang.github.io',
    'zoxide': 'github.com',
    'fnm': 'github.com',
    'hub': 'github.com',
    'mosh': 'mosh.org',
    'restic': 'restic.net',
    'eza': 'github.com',
    'exa': 'github.com',
    'btop': 'github.com',
    'ncdu': 'dev.yorhel.nl',
    'nnn': 'github.com',
    'broot': 'dystroy.org',
    'ranger': 'github.com',
    'neofetch': 'github.com',
    'fastfetch': 'github.com',
    'tealdeer': 'github.com',
    'tldr': 'github.com',
    'xh': 'github.com',
    'sd': 'github.com',
    'glow': 'github.com',
    'just': 'github.com',
    'topgrade': 'github.com',
    'entr': 'github.com',
    'glances': 'github.com',
    'httpstat': 'github.com',
    'http-server': 'github.com',
    'lnav': 'github.com',
    'autojump': 'github.com',
    'ack': 'beyondgrep.com',
    'tree': 'github.com',
    'screen': 'gnu.org',
    'awk': 'gnu.org',
    'rsync': 'github.com',
    'gdb': 'gnu.org',
    'mas': 'github.com',
    'ghq': 'github.com',
    'n': 'github.com',
    'jump': 'github.com',
    'pgcli': 'github.com',
    'rbenv': 'github.com',
    'rvm': 'rvm.io',
    'moreutils': 'joeyh.name',
    'dust': 'github.com',
    'superfile': 'github.com',
    'goku': 'github.com',
    'skhd': 'github.com',
    'yadm': 'github.com',
    'age': 'github.com',
    'pass': 'passwordstore.org',
    'wormhole': 'github.com',
    'llama.cpp': 'github.com',
    'OpenWebUI': 'github.com',
    'Postico': 'eggerapps.at',
    'Sizzy': 'sizzy.co',
    'DevUtils': 'devutils.com',
    'Beyond Compare': 'scootersoftware.com',
    'Paw': 'paw.cloud',
    'Proxyman': 'proxyman.io',
    'Yaak': 'yaak.app',
    'Carrot Weather': 'meetcarrot.com',
    'Clipy': 'clipy-app.com',
    'Workflowy': 'workflowy.com',
    'Zoho Mail': 'zoho.com',
    'pCloud': 'pcloud.com',
    'Carbon Copy Cloner': 'bombich.com',
    'Arq': 'arqbackup.com',
    'Harvest': 'getharvest.com',
    'Stretchly': 'hovancik.net',
    'Flighty': 'flighty.com',
    'UpNote': 'getupnote.com',
    'Mochi': 'mochi.cards',
    'Ulauncher': 'ulauncher.io',
    'Greenshot': 'getgreenshot.org',
    'CloudApp': 'getcloudapp.com',
    'ConvertKit': 'convertkit.com',
    'Buttondown': 'buttondown.email',
    'Beehiiv': 'beehiiv.com',
    'Cronometer': 'cronometer.com',
    'Doppler': 'doppler.com',
    'Brain.fm': 'brain.fm',
    'Endel': 'endel.io',
    'MusicHarbor': 'marcosatanaka.com',
    'Navidrome': 'navidrome.org',
    'Tautulli': 'tautulli.com',
    'Halide': 'halide.cam',
    'Camo Studio': 'reincubate.com',
    'Opal C1': 'opalcamera.com',
    'Insta360 Link': 'insta360.com',
    'Insta360 X3': 'insta360.com',
    'Snapseed': 'snapseed.online',
    'FigJam': 'figma.com',
    'Balsamiq Wireframes': 'balsamiq.com',
    'Fusion 360': 'autodesk.com',
    'Coolors': 'coolors.co',
    'Heroicons': 'heroicons.com',
    'Lucide Icons': 'lucide.dev',
    'SimpleIcons': 'simpleicons.org',
    'Onshape': 'onshape.com',
    'DrawBot': 'drawbot.com',
    'Nik Collection': 'nikcollection.dxo.com',
    'Lightroom CC': 'adobe.com',
    'AeroSpace': 'github.com',
    'Ente Auth': 'ente.io',
    'OpenKeychain': 'openkeychain.org',
    'Dia': 'dia-app.com',
    'Floorp': 'floorp.app',
    'Helium Browser': 'nickswalker.com',
    'Waterfox': 'waterfox.net',
    'Wavebox': 'wavebox.io',
    'Halloy': 'github.com',
    'SoundSource': 'rogueamoeba.com',
    'Loopback': 'rogueamoeba.com',
    'Audio Hijack': 'rogueamoeba.com',
    'Kap': 'getkap.co',
    'Gifski': 'gif.ski',
    'LICEcap': 'cockos.com',
    'Peek': 'github.com',
    'Snagit': 'techsmith.com',
    'Streamlabs OBS': 'streamlabs.com',
    'Restream': 'restream.io',
    'Shutter Encoder': 'shutterencoder.com',
    'Libby': 'libbyapp.com',
    'Foliate': 'github.com',
    'KOReader': 'github.com',
    'Readest': 'github.com',
    'YACReader': 'yacreader.com',
    'Kobo Clara 2E': 'kobo.com',
    'Plex Media Server': 'plex.tv',
    'Plexamp': 'plex.tv',
    'Mailcow': 'mailcow.email',
    'Postfix': 'postfix.org',
    'Prowlarr': 'prowlarr.com',
    'Bazarr': 'bazarr.media',
    'Scrypted': 'scrypted.app',
    'Glance': 'github.com',
    'Samba': 'samba.org',
    'AdGuard Home': 'adguard.com',
    'Ploi': 'ploi.io',
    'Flexispot E7': 'flexispot.com',
    'Flexispot standing desk': 'flexispot.com',
    'Fully Jarvis': 'fully.com',
    'Fully Jarvis Dual Monitor Arm': 'fully.com',
    'Jarvis': 'fully.com',
    'Jarvis Standing Desk': 'fully.com',
    'Autonomous SmartDesk': 'autonomous.ai',
    'Autonomous Standing Desk': 'autonomous.ai',
    'Autonomous ErgoChair': 'autonomous.ai',
    'Autonomous ErgoChair 2': 'autonomous.ai',
    'Autonomous ErgoChair Pro': 'autonomous.ai',
    'Rain Design mStand': 'raindesigninc.com',
    'Rain mStand': 'raindesigninc.com',
    'Roost laptop stand': 'therooststand.com',
    'Roost': 'therooststand.com',
    'Roost V2': 'therooststand.com',
    'Nexstand K2': 'nexstand.io',
    'Ergotron LX': 'ergotron.com',
    'Ergotron HX': 'ergotron.com',
    'Griffin Elevator': 'griffintechnology.com',
    'Twelve South HiRise': 'twelvesouth.com',
    'Vivo Monitor Arm': 'vivo-us.com',
    'DJI Mic Mini': 'dji.com',
    'DJI Mic': 'dji.com',
    'DJI Osmo 360': 'dji.com',
    'Elgato Wave:3': 'elgato.com',
    'Elgato Wave 3': 'elgato.com',
    'Elgato Wave': 'elgato.com',
    'Fifine Microphone': 'fifinemicrophone.com',
    'Audient evo 4': 'audient.com',
    'Audient iD4': 'audient.com',
    'MOTU M4': 'motu.com',
    'Motu M2': 'motu.com',
    'Moondrop Dawn Pro': 'moondroplab.com',
    'Moondrop Kato': 'moondroplab.com',
    'Beats Fit Pro': 'beatsbydre.com',
    'Beats Flex': 'beatsbydre.com',
    'Beats Studio Pro': 'beatsbydre.com',
    'Marshall Major IV': 'marshallheadphones.com',
    'Soundcore Life Q30': 'soundcore.com',
    'Skullcandy Crusher': 'skullcandy.com',
    'OnePlus Bullets Z2': 'oneplus.com',
    'OnePlus 5T': 'oneplus.com',
    'OnePlus 6T': 'oneplus.com',
    'OnePlus 8 Pro': 'oneplus.com',
    'Nothing Phone': 'nothing.tech',
    'Poco F1': 'poco.net',
    'Xiaomi Mi A1': 'mi.com',
    'Xiaomi Mi Monitor Light Bar': 'mi.com',
    'Xiaomi monitor light bar': 'mi.com',
    'Motorola Edge': 'motorola.com',
    'Google Pixel 8': 'store.google.com',
    'Garmin Fenix 7': 'garmin.com',
    'Garmin Forerunner 945': 'garmin.com',
    'Pebble Time': 'rebble.io',
    'PineTime': 'pine64.org',
    'Casio F-91W': 'casio.com',
    'Anker MagGo': 'anker.com',
    'Anker PowerCore': 'anker.com',
    'Anker Prime': 'anker.com',
    'Anker Vertical Mouse': 'anker.com',
    'Anker PowerConf C300': 'anker.com',
    'OWC Thunderbolt Dock': 'owc.com',
    'OWC Thunderbolt 3 Dock': 'owc.com',
    'Brydge Stone Pro': 'brydge.com',
    'UGREEN Nexode': 'ugreen.com',
    'Kensington Expert Mouse': 'kensington.com',
    'Sigma 16mm f/1.4': 'sigma-global.com',
    'Sigma 16mm f1.4': 'sigma-global.com',
    'Sigma 16mm lens': 'sigma-global.com',
    'Sigma 24-70mm F2.8': 'sigma-global.com',
    'Tamron 28-75mm': 'tamron.com',
    'Gorillapod': 'joby.com',
    'Manfrotto Befree': 'manfrotto.com',
    'Philips Hue Play': 'philips-hue.com',
    'Philips Hue Bridge': 'philips-hue.com',
    'Eero Pro 7': 'eero.com',
    'Meshtastic': 'meshtastic.org',
    'Aer Day Sling 3 Ultra': 'aersf.com',
    'Bellroy Classic Backpack': 'bellroy.com',
    'Bellroy Tech Kit': 'bellroy.com',
    'Bellroy Tech Kit Compact': 'bellroy.com',
    'Bellroy Travel Wallet': 'bellroy.com',
    'Field Notes': 'fieldnotesbrand.com',
    'Pilot G2': 'pilotpen.us',
    'TWSBI Eco': 'twsbi.com',
    'Studio Neat Mark One': 'studioneat.com',
    'Ducky One 2': 'duckychannel.com.tw',
    'Ducky One 2 Mini': 'duckychannel.com.tw',
    'Leopold FC660M': 'leopold.co.kr',
    'Anne Pro 2': 'annepro.net',
    'Drop Alt': 'drop.com',
    'Glorious GMMK Pro': 'gloriousgaming.com',
    'Glorious Model O': 'gloriousgaming.com',
    'Royal Kludge RK61': 'rkgaming.com',
    'Kinesis Advantage 360': 'kinesis-ergo.com',
    'Ultimate Hacking Keyboard': 'ultimatehackingkeyboard.com',
    'Dygma Defy': 'dygma.com',
    'Dygma Raise': 'dygma.com',
    'Varmilo VA87M': 'varmilo.com',
    'Corne': 'github.com',
    'Lily58': 'github.com',
    'OLKB Planck': 'olkb.com',
    'Planck': 'olkb.com',
    'DZ60': 'kbdfans.com',
    'Gazzew Boba U4T': 'gazzew.com',
    'NovelKeys NK65': 'novelkeys.com',
    'ViewSonic': 'viewsonic.com',
    'AOC': 'aoc.com',
    'AOC U3277PWQU': 'aoc.com',
    'Thunderbolt Display': 'apple.com',
    'Ember Mug': 'ember.com',
    'Hydro Flask': 'hydroflask.com',
    'Owala FreeSip': 'owalalife.com',
    'Yeti Mug': 'yeti.com',
    'AeroPress': 'aeropress.com',
    'AeroPress Go': 'aeropress.com',
    'Hario V60': 'hario-usa.com',
    'Hario V60 Drip Decanter': 'hario-usa.com',
    'Bialetti Moka Express': 'bialetti.com',
    'Sage Barista Express': 'sageappliances.com',
    'Fellow Opus': 'fellowproducts.com',
    'Fellow Prismo': 'fellowproducts.com',
    'Fellow Stagg EKG': 'fellowproducts.com',
    'Breville Bambino Plus': 'breville.com',
    'Cafelat Robot': 'cafelat.com',
    'Strong': 'strong.app',
    'Paprika': 'paprikaapp.com',
    'Ente Auth': 'ente.io',
    'TunnelBear': 'tunnelbear.com',
    'Tunnelblick': 'tunnelblick.net',
    'PiVPN': 'pivpn.io',
    'VPN Unlimited': 'keepsolid.com',
    'Hemingway App': 'hemingwayapp.com',
    'TypingMind': 'typingmind.com',
    'Actual': 'actualbudget.org',
    'Coin': 'coin.space',
    'Mercury Bank': 'mercury.com',
    'SavvyCal': 'savvycal.com',
    'Tapestry': 'tapestry.so',
    'Missive': 'missiveapp.com',
    'Anybox': 'anybox.app',
    'Mela': 'mela.recipes',
    'MeetingBar': 'meetingbar.app',
    'BatFi': 'github.com',
    'Audiopen': 'audiopen.ai',
    'Plottr': 'plottr.com',
    'Tasks.org': 'tasks.org',
    'Tasksboard': 'tasksboard.com',
    'Waking Up': 'wakingup.com',
    'MyMind': 'mymind.com',
    'Deckset': 'deckset.com',
    'Gifox': 'gifox.app',
    'TextSniper': 'textsniper.app',
    'Wispr Flow': 'wispr.ai',
    'Superwhisper': 'superwhisper.com',
    'ScriptKit': 'scriptkit.com',
    'Keypirinha': 'keypirinha.com',
    'FreeAgent': 'freeagent.com',
    'Cronometer': 'cronometer.com',
    'Booking.com': 'booking.com',
    'Citymapper': 'citymapper.com',
    'OsmAnd+': 'osmand.net',
    'StreetComplete': 'streetcomplete.app',
    'Flighty': 'flighty.com',
    'Merlin Bird ID': 'merlin.allaboutbirds.org',
    'Foodnoms': 'foodnoms.com',
    'MacroFactor': 'macrofactorapp.com',
    'Olam': 'olam.in',
    'BoldVoice': 'boldvoice.com',
    'Laracasts': 'laracasts.com',
    'Syntax': 'syntax.fm',
    'JavaScript Jabber': 'topenddevs.com',
    'The Changelog': 'changelog.com',
    'ShopTalk Show': 'shoptalkshow.com',
    'Node Weekly': 'nodeweekly.com',
    'Storybook': 'storybook.js.org',
    'Excalidraw': 'excalidraw.com',
    'Espanso': 'espanso.org',
    'LocalSend': 'localsend.org',
    'Handbrake': 'handbrake.fr',
    'Altair': 'altairgraphql.dev',
    'ImHex': 'imhex.werwolv.net',
    'Binary Ninja': 'binary.ninja',
    'MiniSim': 'github.com',
    'Nessus': 'tenable.com',
    'Metasploit Framework': 'metasploit.com',
    'Screaming Frog SEO Spider': 'screamingfrog.co.uk',
    'Metatags.io': 'metatags.io',
    'WinSCP': 'winscp.net',
    'mRemoteNG': 'mremoteng.org',
    'Remmina': 'remmina.org',
    'Kaleidoscope': 'kaleidoscope.app',
    'Monodraw': 'monodraw.helftone.com',
    'Balena Etcher': 'etcher.balena.io',
    'balenaEtcher': 'etcher.balena.io',
    'Aircrack-ng': 'aircrack-ng.org',
    'John the Ripper': 'openwall.com',
    'sqlmap': 'sqlmap.org',
    'Nmap': 'nmap.org',
    'ImageMagick': 'imagemagick.org',
    'Gifsicle': 'lcdf.org',
    'IrfanView': 'irfanview.com',
    'Gwenview': 'kde.org',
    'Skitch': 'evernote.com',
    'TinyPNG': 'tinypng.com',
    'SVGOMG': 'jakearchibald.github.io',
    'Flaticon': 'flaticon.com',
    'Color Picker': 'github.com',
    'Pika': 'superhighfidelity.com',
    'xScope': 'xscopeapp.com',
    'Snap.svg': 'snapsvg.io',
    'linkding': 'github.com',
    'giscus': 'giscus.app',
    'Comet': 'github.com',
    'Mole': 'github.com',
    'KVM': 'linux-kvm.org',
    'Flipper': 'github.com',
    'irssi': 'irssi.org',
    'weechat': 'weechat.org',
    'w3m': 'github.com',
    'Lynx': 'lynx.invisible-island.net',
    'Midnight Commander': 'midnight-commander.org',
    'Everything': 'voidtools.com',
    'OpenMTP': 'openmtp.ganeshrvel.com',
    'Mountain Duck': 'mountainduck.io',
    'Nautilus': 'gnome.org',
    'Thunar': 'xfce.org',
    'Tresorit': 'tresorit.com',
    'Koofr': 'koofr.eu',
    'FreeFileSync': 'freefilesync.org',
    'Maestral': 'maestral.app',
    'NAS': 'synology.com',
    'SSD': 'samsung.com',
    'Qobuz': 'qobuz.com',
    'ListenBrainz': 'listenbrainz.org',
    'MusicBrainz Picard': 'picard.musicbrainz.org',
    'Swinsian': 'swinsian.com',
    'Symfonium': 'symfonium.app',
    'beets': 'beets.io',
    'Rhythmbox': 'gnome.org',
    'Fender Stratocaster': 'fender.com',
    'Arturia Minilab 3': 'arturia.com',
    'Finale': 'finalemusic.com',
    'Korg nanokey2': 'korg.com',
    'Kontakt': 'native-instruments.com',
    'iZotope Ozone': 'izotope.com',
    'iZotope RX': 'izotope.com',
    'Splice': 'splice.com',
    'Droid-ify': 'github.com',
    'Nova Launcher': 'novalauncher.com',
    'Vanadium': 'grapheneos.org',
    'ChatGPT Atlas': 'openai.com',
    'Creality Ender 3': 'creality.com',
    'Bambu Labs A1': 'bambulab.com',
    'PrusaSlicer': 'prusa3d.com',
    'Ultimaker Cura': 'ultimaker.com',
    'Pinecil v2': 'pine64.org',
    'Pinebook Pro': 'pine64.org',
    'GPD Pocket 4': 'gpd.hk',
    'TRMNL': 'usetrmnl.com',
    'CrossOver': 'codeweavers.com',
    'WLED': 'kno.wled.ge',
    'Amethyst': 'ianyh.com',
    'Übersicht': 'tracesof.net',
    'Textastic': 'textasticapp.com',
    'TeXstudio': 'texstudio.org',
    'FairEmail': 'email.faircode.eu',
    'aerc': 'aerc-mail.org',
    'Neomutt': 'neomutt.org',
    'mutt': 'mutt.org',
    'mbsync': 'isync.sourceforge.io',
    'msmtp': 'marlam.de',
    'K-9 Mail': 'k9mail.app',
    'Fossify Calendar': 'fossify.org',
    'Fossify Contacts': 'fossify.org',
    'Aurora Store': 'auroraoss.com',
    'Heliboard': 'github.com',
    'Dired': 'gnu.org',
    'Emmet': 'emmet.io',
    'Stardew Valley': 'stardewvalley.net',
    'Two Dots': 'weplaydots.com',
    'Typefully': 'typefully.com',
    'SavvyCal': 'savvycal.com',
    'Notesnook': 'notesnook.com',
    'NeueChair': 'neuechair.com',
    'Branch Ergonomic Chair': 'branchfurniture.com',
    'Lian Li O11 Dynamic Mini': 'lian-li.com',
    'Fractal Design North': 'fractal-design.com',
    'NZXT S340': 'nzxt.com',
    'ASRock X570 Phantom Gaming 4': 'asrock.com',
    'Fujitsu ScanSnap S1300i': 'fujitsu.com',
    'Sakura Pigma Micron': 'sakuraofamerica.com',
    'Sharpie': 'sharpie.com',
    'Moleskine': 'moleskine.com',
    'Patagonia': 'patagonia.com',
    'Flipper Zero': 'flipperzero.one',
    'Libreboot': 'libreboot.org',
    'Librera Reader': 'github.com',
    'Storytel': 'storytel.com',
    'YouTube Premium': 'youtube.com',
    'iwantmyname.com': 'iwantmyname.com',
    'Zojirushi': 'zojirushi.com',
    'Bodum French press': 'bodum.com',
    'French press': 'bodum.com',
    'Hario coffee mill': 'hario-usa.com',
    'i3status-rust': 'github.com',
    'waybar': 'github.com',
    'rofi': 'github.com',
    'stumpwm': 'stumpwm.github.io',
    'xmonad': 'xmonad.org',
    'hypridle': 'github.com',
    'Hyprlock': 'github.com',
    'Panels': 'github.com',
    'Magento': 'magento.com',
    'Sapper': 'sapper.svelte.dev',
    'Lostgrid': 'github.com',
    'Twig': 'twig.symfony.com',
    'Zustand': 'github.com',
    'TanStack Query': 'tanstack.com',
    'Inertia.js': 'inertiajs.com',
    'Rails': 'rubyonrails.org',
    'ExpressJS': 'expressjs.com',
    'AngularJS': 'angularjs.org',
    'NextJS': 'nextjs.org',
    'ASP.NET': 'dotnet.microsoft.com',
    'Processing': 'processing.org',
    'Godot': 'godotengine.org',
    'Lando': 'lando.dev',
    'DDEV': 'ddev.com',
    'Homestead': 'laravel.com',
    'Local by Flywheel': 'localwp.com',
    'LocalWP': 'localwp.com',
    'WP-CLI': 'wp-cli.org',
    'Coolify': 'coolify.io',
    'Traefik': 'traefik.io',
    'ArgoCD': 'argoproj.github.io',
    'Serverless Framework': 'serverless.com',
    'k9s': 'k9scli.io',
    'kubectx': 'github.com',
    'microk8s': 'microk8s.io',
    'OpenAI APIs': 'openai.com',
    'Docker Compose': 'docs.docker.com',
    'Docker Swarm': 'docs.docker.com',
    'Hetzner Cloud': 'hetzner.com',
    'Linode': 'linode.com',
    'Backblaze B2': 'backblaze.com',
    'DNSimple': 'dnsimple.com',
    'Dreamhost': 'dreamhost.com',
    'GitLab Pages': 'gitlab.com',
    'GitLab CI': 'gitlab.com',
    'GitLab CI/CD': 'gitlab.com',
    'Oracle Cloud': 'oracle.com',
    'VPS': 'digitalocean.com',
    'Proxmox VE': 'proxmox.com',
    'DietPi': 'dietpi.com',
    'Omarchy': 'omakub.org',
    'Hackintosh': 'hackintosh.com',
    'Parallels': 'parallels.com',
    'Parallels Desktop': 'parallels.com',
    'UTM': 'mac.getutm.app',
    'Borg': 'borgbackup.readthedocs.io',
    'Vorta': 'vorta.borgbase.com',
    'restic': 'restic.net',
    'Chezmoi': 'chezmoi.io',
    'yadm': 'yadm.io',
    'dotfiles': 'dotfiles.github.io',
    'Fathom Analytics': 'usefathom.com',
    'GoatCounter': 'goatcounter.com',
    'Plausible': 'plausible.io',
    'Hacker News': 'news.ycombinator.com',
    'Tweetbot': 'tapbots.com',
    'Mona': 'mastodon.social',
    'Ivory for Mastodon': 'tapbots.com',
    'Elk': 'elk.zone',
    'Moshidon': 'github.com',
    'Beeper': 'beeper.com',
    'Ferdium': 'ferdium.org',
    'Franz': 'meetfranz.com',
    'Rambox': 'rambox.app',
    'Facebook Messenger': 'messenger.com',
    'Halloy': 'github.com',
    'Messages': 'apple.com',
    'Signal Desktop': 'signal.org',
    'Standard Notes': 'standardnotes.com',
    'Simplenote': 'simplenote.com',
    'Notesnook': 'notesnook.com',
    'Ente Auth': 'ente.io',
    'GnuPG': 'gnupg.org',
    'GPG Suite': 'gpgtools.org',
    'YubiKey': 'yubico.com',
    'YubiKey 5C NFC': 'yubico.com',
    'VeraCrypt': 'veracrypt.fr',
    'OpenKeychain': 'openkeychain.org',
    'PiVPN': 'pivpn.io',
    'TunnelBear': 'tunnelbear.com',
    'Tunnelblick': 'tunnelblick.net',
    'Cloudflare WARP': 'one.one.one.one',
    'VPN Unlimited': 'vpnunlimitedapp.com',
    'Mozilla Thunderbird': 'thunderbird.net',
    'Betterbird': 'betterbird.eu',
    'Outlook': 'outlook.com',
    'Mailspring': 'getmailspring.com',
    'Postbox': 'postbox-inc.com',
    'aerc': 'aerc-mail.org',
    'Neomutt': 'neomutt.org',
    'mutt': 'mutt.org',
    'K-9 Mail': 'k9mail.app',
    'FairEmail': 'email.faircode.eu',
    'Canary Mail': 'canarymail.io',
    'Spark Mail': 'sparkmailapp.com',
    'Fastmail': 'fastmail.com',
    'ProtonDrive': 'proton.me',
    'Proton Pass': 'proton.me',
    'newsboat': 'newsboat.org',
    'FreshRSS': 'freshrss.org',
    'Capy Reader': 'capyreader.com',
    'Feeder': 'github.com',
    'Unread': 'goldenhillsoftware.com',
    'Reeder': 'reederapp.com',
    'NetNewsWire': 'netnewswire.com',
    'Feedbin': 'feedbin.com',
    'Miniflux': 'miniflux.app',
    'Catppuccin': 'catppuccin.com',
    'Dracula': 'draculatheme.com',
    'Dracula Pro': 'draculatheme.com',
    'Cyberduck': 'cyberduck.io',
    'Typora': 'typora.io',
    'iA Writer': 'ia.net',
    'iA Presenter': 'ia.net',
    'Readwise': 'readwise.io',
    'Readwise Reader': 'readwise.io',
    'YNAB': 'ynab.com',
    'You Need A Budget': 'ynab.com',
    'Espanso': 'espanso.org',
    'LocalSend': 'localsend.org',
    'Handbrake': 'handbrake.fr',
    'ImageOptim': 'imageoptim.com',
    'Zeplin': 'zeplin.io',
    'Ableton Live': 'ableton.com',
    'Reaper': 'reaper.fm',
    'FL Studio': 'image-line.com',
    'Splice': 'splice.com',
    'Navidrome': 'navidrome.org',
    'Deezer': 'deezer.com',
    'Brain.fm': 'brain.fm',
    'Endel': 'endel.io',
    'MusicHarbor': 'marcosatanaka.com',
    'Plexamp': 'plex.tv',
    'Qobuz': 'qobuz.com',
    'ListenBrainz': 'listenbrainz.org',
    'Swinsian': 'swinsian.com',
    'Symfonium': 'symfonium.app',
    'Shortwave': 'shortwave.com',
    'cmus': 'cmus.github.io',
    'mpd': 'musicpd.org',
    'ncmpcpp': 'github.com',
    'mpc': 'musicpd.org',
    'Descript': 'descript.com',
    'Shotcut': 'shotcut.org',
    'Vegas Pro': 'vegascreativesoftware.com',
    'Camtasia': 'techsmith.com',
    'CapCut': 'capcut.com',
    'iMovie': 'apple.com',
    'Final Cut Pro': 'apple.com',
    'DaVinci Resolve Studio': 'blackmagicdesign.com',
    'ScreenFlow': 'telestream.net',
    'Screen Studio': 'screen.studio',
    'Streamlabs OBS': 'streamlabs.com',
    'Restream': 'restream.io',
    'Shutter Encoder': 'shutterencoder.com',
    'Snagit': 'techsmith.com',
    'LICEcap': 'cockos.com',
    'Peek': 'github.com',
    'Greenshot': 'getgreenshot.org',
    'Flameshot': 'flameshot.org',
    'Kap': 'getkap.co',
    'Gifski': 'gif.ski',
    'Gifox': 'gifox.app',
    'Giphy Capture': 'giphy.com',
    'Libby': 'libbyapp.com',
    'Foliate': 'github.com',
    'KOReader': 'github.com',
    'Readest': 'github.com',
    'YACReader': 'yacreader.com',
    'Amazon Kindle': 'amazon.com',
    'Amazon Kindle Paperwhite': 'amazon.com',
    'Kobo Clara 2E': 'kobo.com',
    'Acorn': 'flyingmeat.com',
    'darktable': 'darktable.org',
    'Snapseed': 'snapseed.online',
    'Darkroom': 'darkroom.co',
    'Photomator': 'pixelmator.com',
    'Capture One': 'captureone.com',
    'Pixelmator': 'pixelmator.com',
    'Paint.NET': 'getpaint.net',
    'Image2Icon': 'img2icnsapp.com',
    'Pika': 'superhighfidelity.com',
    'ColorSnapper 2': 'colorsnapper.com',
    'System Color Picker': 'github.com',
    'Coolors': 'coolors.co',
    'Heroicons': 'heroicons.com',
    'Lucide Icons': 'lucide.dev',
    'SimpleIcons': 'simpleicons.org',
    'Onshape': 'onshape.com',
    'DrawBot': 'drawbot.com',
    'Nik Collection': 'nikcollection.dxo.com',
    'Balsamiq Wireframes': 'balsamiq.com',
    'Fusion 360': 'autodesk.com',
    'FigJam': 'figma.com',
    'Freeform': 'apple.com',
    'PixelSnap 2': 'getpixelsnap.com',
    'xScope': 'xscopeapp.com',
    'CloudCompare': 'cloudcompare.org',
    'Dia': 'dia-app.com',
    'Floorp': 'floorp.app',
    'Helium Browser': 'nickswalker.com',
    'Waterfox': 'waterfox.net',
    'Wavebox': 'wavebox.io',
    'Orion': 'kagi.com',
    'Vanadium': 'grapheneos.org',
    'ChatGPT Atlas': 'openai.com',
    'Fennec': 'f-droid.org',
    'Firefox Focus': 'mozilla.org',
    'Postico': 'eggerapps.at',
    'HeidiSQL': 'heidisql.com',
    'Oracle': 'oracle.com',
    'ChromaDB': 'trychroma.com',
    'Postgres.app': 'postgresapp.com',
    'MySQL Workbench': 'mysql.com',
    'Robo 3T': 'robomongo.org',
    'TablePlus': 'tableplus.com',
    'Sizzy': 'sizzy.co',
    'DevUtils': 'devutils.com',
    'Beyond Compare': 'scootersoftware.com',
    'Yaak': 'yaak.app',
    'Proxyman': 'proxyman.io',
    'Altair': 'altairgraphql.dev',
    'ImHex': 'imhex.werwolv.net',
    'Binary Ninja': 'binary.ninja',
    'MiniSim': 'github.com',
    'Nessus': 'tenable.com',
    'Metasploit Framework': 'metasploit.com',
    'Screaming Frog SEO Spider': 'screamingfrog.co.uk',
    'Metatags.io': 'metatags.io',
    'WinSCP': 'winscp.net',
    'mRemoteNG': 'mremoteng.org',
    'Remmina': 'remmina.org',
    'Kaleidoscope': 'kaleidoscope.app',
    'Monodraw': 'monodraw.helftone.com',
    'Balena Etcher': 'etcher.balena.io',
    'balenaEtcher': 'etcher.balena.io',
    'Aircrack-ng': 'aircrack-ng.org',
    'John the Ripper': 'openwall.com',
    'sqlmap': 'sqlmap.org',
    'Chrome DevTools': 'developer.chrome.com',
    'WebPageTest': 'webpagetest.org',
    'BrowserStack': 'browserstack.com',
    'CodeKit': 'codekitapp.com',
    'ResponsivelyApp': 'responsively.app',
    'Responsively': 'responsively.app',
    'PHPUnit': 'phpunit.de',
    'PestPHP': 'pestphp.com',
    'PHP Monitor': 'phpmon.app',
    'Laravel Forge': 'forge.laravel.com',
    'Laravel Mix': 'laravel-mix.com',
    'Valet': 'laravel.com',
    'MAMP Pro': 'mamp.info',
    'Ploi': 'ploi.io',
    'React Testing Library': 'testing-library.com',
    'Storybook': 'storybook.js.org',
    'Excalidraw': 'excalidraw.com',
    'Pandoc': 'pandoc.org',
    'Graphviz': 'graphviz.org',
    'JMeter': 'jmeter.apache.org',
    'giscus': 'giscus.app',
    'Comet': 'github.com',
    'Mole': 'github.com',
    'KVM': 'linux-kvm.org',
    'Flipper': 'github.com',
    'llama.cpp': 'github.com',
    'OpenWebUI': 'github.com',
    'Tabnine': 'tabnine.com',
    'Mistral': 'mistral.ai',
    'Doppler': 'doppler.com',
    'Carrot Weather': 'meetcarrot.com',
    'Clipy': 'clipy-app.com',
    'Workflowy': 'workflowy.com',
    'Zoho Mail': 'zoho.com',
    'pCloud': 'pcloud.com',
    'Carbon Copy Cloner': 'bombich.com',
    'Arq': 'arqbackup.com',
    'Harvest': 'getharvest.com',
    'Stretchly': 'hovancik.net',
    'UpNote': 'getupnote.com',
    'Mochi': 'mochi.cards',
    'Ulauncher': 'ulauncher.io',
    'CloudApp': 'getcloudapp.com',
    'ConvertKit': 'convertkit.com',
    'Buttondown': 'buttondown.email',
    'Beehiiv': 'beehiiv.com',
    'Flighty': 'flighty.com',
    'Postico': 'eggerapps.at',
    'Sizzy': 'sizzy.co',
    'DevUtils': 'devutils.com',
    'Yaak': 'yaak.app',
    'Proxyman': 'proxyman.io',
    'Working Copy': 'workingcopyapp.com',
    'Tautulli': 'tautulli.com',
    'Halide': 'halide.cam',
    'Camo Studio': 'reincubate.com',
    'SoundSource': 'rogueamoeba.com',
    'Loopback': 'rogueamoeba.com',
    'Audio Hijack': 'rogueamoeba.com',
    'Ember Mug': 'ember.com',
    'Hydro Flask': 'hydroflask.com',
    'Owala FreeSip': 'owalalife.com',
    'Yeti Mug': 'yeti.com',
    'AeroPress': 'aeropress.com',
    'Hario V60': 'hario-usa.com',
    'Bialetti Moka Express': 'bialetti.com',
    'Sage Barista Express': 'sageappliances.com',
    'Strong': 'strong.app',
    'Paprika': 'paprikaapp.com',
    'Hemingway App': 'hemingwayapp.com',
    'TypingMind': 'typingmind.com',
    'Actual': 'actualbudget.org',
    'Coin': 'coin.space',
    'Mercury Bank': 'mercury.com',
    'Tapestry': 'tapestry.so',
    'Missive': 'missiveapp.com',
    'Anybox': 'anybox.app',
    'Mela': 'mela.recipes',
    'MeetingBar': 'meetingbar.app',
    'Audiopen': 'audiopen.ai',
    'Plottr': 'plottr.com',
    'Tasks.org': 'tasks.org',
    'Tasksboard': 'tasksboard.com',
    'Waking Up': 'wakingup.com',
    'MyMind': 'mymind.com',
    'Deckset': 'deckset.com',
    'TextSniper': 'textsniper.app',
    'Wispr Flow': 'wispr.ai',
    'Superwhisper': 'superwhisper.com',
    'ScriptKit': 'scriptkit.com',
    'FreeAgent': 'freeagent.com',
    'Booking.com': 'booking.com',
    'Citymapper': 'citymapper.com',
    'OsmAnd+': 'osmand.net',
    'StreetComplete': 'streetcomplete.app',
    'Merlin Bird ID': 'merlin.allaboutbirds.org',
    'Foodnoms': 'foodnoms.com',
    'MacroFactor': 'macrofactorapp.com',
    'Olam': 'olam.in',
    'BoldVoice': 'boldvoice.com',
    'Laracasts': 'laracasts.com',
    'Syntax': 'syntax.fm',
    'JavaScript Jabber': 'topenddevs.com',
    'The Changelog': 'changelog.com',
    'ShopTalk Show': 'shoptalkshow.com',
    'Node Weekly': 'nodeweekly.com',
    'Droid-ify': 'github.com',
    'Nova Launcher': 'novalauncher.com',
    'Aurora Store': 'auroraoss.com',
    'Heliboard': 'github.com',
    'Fossify Calendar': 'fossify.org',
    'Fossify Contacts': 'fossify.org',
    'Creality Ender 3': 'creality.com',
    'Bambu Labs A1': 'bambulab.com',
    'PrusaSlicer': 'prusa3d.com',
    'Ultimaker Cura': 'ultimaker.com',
    'Pinecil v2': 'pine64.org',
    'Pinebook Pro': 'pine64.org',
    'GPD Pocket 4': 'gpd.hk',
    'TRMNL': 'usetrmnl.com',
    'CrossOver': 'codeweavers.com',
    'WLED': 'kno.wled.ge',
    'Amethyst': 'ianyh.com',
    'Übersicht': 'tracesof.net',
    'Textastic': 'textasticapp.com',
    'TeXstudio': 'texstudio.org',
    'Stardew Valley': 'stardewvalley.net',
    'Minecraft': 'minecraft.net',
    'Dolphin': 'dolphin-emu.org',
    'PCSX2': 'pcsx2.net',
    'Prism Launcher': 'prismlauncher.org',
    'OpenEmu': 'openemu.org',
    'Heroic Games Launcher': 'heroicgameslauncher.com',
    'Oculus Rift S': 'meta.com',
    'Playdate': 'play.date',
    'Two Dots': 'weplaydots.com',
    'Typefully': 'typefully.com',
    'NeueChair': 'neuechair.com',
    'Branch Ergonomic Chair': 'branchfurniture.com',
    'Lian Li O11 Dynamic Mini': 'lian-li.com',
    'Fractal Design North': 'fractal-design.com',
    'NZXT S340': 'nzxt.com',
    'Fujitsu ScanSnap S1300i': 'fujitsu.com',
    'Moleskine': 'moleskine.com',
    'Patagonia': 'patagonia.com',
    'Flipper Zero': 'flipperzero.one',
    'Storytel': 'storytel.com',
    'YouTube Premium': 'youtube.com',
    'iwantmyname.com': 'iwantmyname.com',
    'Zojirushi': 'zojirushi.com',
    'Tesla Model 3': 'tesla.com',
    'Libreboot': 'libreboot.org',
    'Librera Reader': 'github.com',
    'Bodum French press': 'bodum.com',
    'Hario coffee mill': 'hario-usa.com',
    'Fellow Opus': 'fellowproducts.com',
    'Fellow Prismo': 'fellowproducts.com',
    'Fellow Stagg EKG': 'fellowproducts.com',
    'Breville Bambino Plus': 'breville.com',
    'Cafelat Robot': 'cafelat.com',
    'Sage Barista Express': 'sageappliances.com',
    'Flexispot E7': 'flexispot.com',
    'Flexispot standing desk': 'flexispot.com',
    'Fully Jarvis': 'fully.com',
    'Fully Jarvis Dual Monitor Arm': 'fully.com',
    'Jarvis': 'fully.com',
    'Jarvis Standing Desk': 'fully.com',
    'Autonomous SmartDesk': 'autonomous.ai',
    'Autonomous Standing Desk': 'autonomous.ai',
    'Autonomous ErgoChair': 'autonomous.ai',
    'Autonomous ErgoChair 2': 'autonomous.ai',
    'Autonomous ErgoChair Pro': 'autonomous.ai',
    'Rain Design mStand': 'raindesigninc.com',
    'Rain mStand': 'raindesigninc.com',
    'Roost laptop stand': 'therooststand.com',
    'Roost': 'therooststand.com',
    'Roost V2': 'therooststand.com',
    'Nexstand K2': 'nexstand.io',
    'Ergotron LX': 'ergotron.com',
    'Ergotron HX': 'ergotron.com',
    'Griffin Elevator': 'griffintechnology.com',
    'Twelve South HiRise': 'twelvesouth.com',
    'Vivo Monitor Arm': 'vivo-us.com',
    'DJI Mic Mini': 'dji.com',
    'DJI Mic': 'dji.com',
    'DJI Osmo 360': 'dji.com',
    'Fifine Microphone': 'fifinemicrophone.com',
    'Audient evo 4': 'audient.com',
    'Audient iD4': 'audient.com',
    'MOTU M4': 'motu.com',
    'Motu M2': 'motu.com',
    'Moondrop Dawn Pro': 'moondroplab.com',
    'Moondrop Kato': 'moondroplab.com',
    'Beats Fit Pro': 'beatsbydre.com',
    'Beats Flex': 'beatsbydre.com',
    'Beats Studio Pro': 'beatsbydre.com',
    'Marshall Major IV': 'marshallheadphones.com',
    'Soundcore Life Q30': 'soundcore.com',
    'Skullcandy Crusher': 'skullcandy.com',
    'OnePlus Bullets Z2': 'oneplus.com',
    'OnePlus 5T': 'oneplus.com',
    'OnePlus 6T': 'oneplus.com',
    'OnePlus 8 Pro': 'oneplus.com',
    'Nothing Phone': 'nothing.tech',
    'Poco F1': 'poco.net',
    'Xiaomi Mi A1': 'mi.com',
    'Xiaomi Mi Monitor Light Bar': 'mi.com',
    'Xiaomi monitor light bar': 'mi.com',
    'Motorola Edge': 'motorola.com',
    'Garmin Fenix 7': 'garmin.com',
    'Garmin Forerunner 945': 'garmin.com',
    'Pebble Time': 'rebble.io',
    'PineTime': 'pine64.org',
    'Casio F-91W': 'casio.com',
    'Anker MagGo': 'anker.com',
    'Anker PowerCore': 'anker.com',
    'Anker Prime': 'anker.com',
    'Anker Vertical Mouse': 'anker.com',
    'Anker PowerConf C300': 'anker.com',
    'OWC Thunderbolt Dock': 'owc.com',
    'OWC Thunderbolt 3 Dock': 'owc.com',
    'Brydge Stone Pro': 'brydge.com',
    'UGREEN Nexode': 'ugreen.com',
    'Kensington Expert Mouse': 'kensington.com',
    'Sigma 16mm f/1.4': 'sigma-global.com',
    'Sigma 16mm f1.4': 'sigma-global.com',
    'Sigma 16mm lens': 'sigma-global.com',
    'Sigma 24-70mm F2.8': 'sigma-global.com',
    'Tamron 28-75mm': 'tamron.com',
    'Gorillapod': 'joby.com',
    'Manfrotto Befree': 'manfrotto.com',
    'Philips Hue Play': 'philips-hue.com',
    'Philips Hue Bridge': 'philips-hue.com',
    'Eero Pro 7': 'eero.com',
    'Meshtastic': 'meshtastic.org',
    'Aer Day Sling 3 Ultra': 'aersf.com',
    'Bellroy Classic Backpack': 'bellroy.com',
    'Bellroy Tech Kit': 'bellroy.com',
    'Bellroy Tech Kit Compact': 'bellroy.com',
    'Bellroy Travel Wallet': 'bellroy.com',
    'Field Notes': 'fieldnotesbrand.com',
    'Pilot G2': 'pilotpen.us',
    'TWSBI Eco': 'twsbi.com',
    'Studio Neat Mark One': 'studioneat.com',
    'Ducky One 2': 'duckychannel.com.tw',
    'Ducky One 2 Mini': 'duckychannel.com.tw',
    'Leopold FC660M': 'leopold.co.kr',
    'Anne Pro 2': 'annepro.net',
    'Drop Alt': 'drop.com',
    'Glorious GMMK Pro': 'gloriousgaming.com',
    'Glorious Model O': 'gloriousgaming.com',
    'Royal Kludge RK61': 'rkgaming.com',
    'Kinesis Advantage 360': 'kinesis-ergo.com',
    'Ultimate Hacking Keyboard': 'ultimatehackingkeyboard.com',
    'Dygma Defy': 'dygma.com',
    'Dygma Raise': 'dygma.com',
    'Varmilo VA87M': 'varmilo.com',
    'Corne': 'github.com',
    'Lily58': 'github.com',
    'OLKB Planck': 'olkb.com',
    'Planck': 'olkb.com',
    'DZ60': 'kbdfans.com',
    'Gazzew Boba U4T': 'gazzew.com',
    'NovelKeys NK65': 'novelkeys.com',
    'Mode Eighty': 'modedesigns.com',
    'Cosmic Byte CB-GK-16': 'cosmicbyte.com',
    'Ajazz AK33': 'ajazz.com',
    'ViewSonic': 'viewsonic.com',
    'AOC': 'aoc.com',
    'AOC U3277PWQU': 'aoc.com',
    'Thunderbolt Display': 'apple.com',
    'IrfanView': 'irfanview.com',
    'Gwenview': 'kde.org',
    'Skitch': 'evernote.com',
    'Everything': 'voidtools.com',
    'OpenMTP': 'openmtp.ganeshrvel.com',
    'Mountain Duck': 'mountainduck.io',
    'Nautilus': 'gnome.org',
    'Thunar': 'xfce.org',
    'ranger': 'github.com',
    'Tresorit': 'tresorit.com',
    'Koofr': 'koofr.eu',
    'FreeFileSync': 'freefilesync.org',
    'Maestral': 'maestral.app',
    'NAS': 'synology.com',
    'SSD': 'samsung.com',
    'external SSD': 'samsung.com',
    'External HDD': 'seagate.com',
    'external drive': 'seagate.com',
    'iCloud Drive': 'apple.com',
    'Kingston A400': 'kingston.com',
  };

  for (const [name, domain] of Object.entries(faviconItems)) {
    add(name, fav(domain));
  }

  return overrides;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Fetching SVGL catalog...');
  const svglRes = await fetch('https://api.svgl.app');
  const svglData: SvglEntry[] = (await svglRes.json()) as SvglEntry[];
  console.log(`  Got ${svglData.length} SVGL entries`);

  const siPath = '/tmp/simple-icons.json';
  let siData: SimpleIconEntry[];
  try {
    siData = JSON.parse(readFileSync(siPath, 'utf8'));
  } catch {
    console.log('Fetching Simple Icons catalog...');
    const siRes = await fetch(
      'https://cdn.jsdelivr.net/npm/simple-icons@latest/_data/simple-icons.json'
    );
    siData = (await siRes.json()) as SimpleIconEntry[];
    writeFileSync(siPath, JSON.stringify(siData));
  }
  console.log(`  Got ${siData.length} Simple Icons entries`);

  // Build SVGL lookup
  const svglByTitle = new Map<string, SvglEntry>();
  for (const entry of svglData) {
    svglByTitle.set(entry.title.toLowerCase(), entry);
  }

  // Build SI slug set and title lookup
  const siSlugs = new Set<string>();
  const siTitleMap = new Map<string, string>();
  for (const icon of siData) {
    const slug = siSlug(icon.title);
    siSlugs.add(slug);
    siTitleMap.set(icon.title.toLowerCase(), icon.title);
    if (icon.aliases?.aka) {
      for (const aka of icon.aliases.aka) {
        siTitleMap.set(aka.toLowerCase(), icon.title);
      }
    }
  }

  // Build manual overrides with validation
  console.log('\nBuilding manual overrides...');
  const MANUAL_OVERRIDES = buildManualOverrides(siSlugs, svglByTitle);
  console.log(`  ${Object.keys(MANUAL_OVERRIDES).length} manual overrides\n`);

  // Parse current items
  const src = readFileSync(ITEMS_PATH, 'utf8');
  const itemMatches = [
    ...src.matchAll(
      /\{ itemSlug: "([^"]+)", itemName: "([^"]+)", tags: (\[[^\]]*\]), itemImage: [^}]+ \}/g
    ),
  ];

  const items: ItemEntry[] = itemMatches.map((m) => ({
    slug: m[1],
    name: m[2],
    tags: JSON.parse(m[3]),
    image: null,
  }));

  console.log(`Processing ${items.length} items...\n`);

  let manualHits = 0;
  let svglHits = 0;
  let siHits = 0;
  let misses = 0;

  for (const item of items) {
    // Tier 0: Manual override
    if (MANUAL_OVERRIDES[item.name]) {
      item.image = MANUAL_OVERRIDES[item.name];
      manualHits++;
      continue;
    }

    // Tier 1: SVGL (exact match or alias)
    const svglKey = SVGL_ALIASES[item.name]?.toLowerCase() ?? item.name.toLowerCase();
    const svglEntry = svglByTitle.get(svglKey);
    if (svglEntry) {
      item.image = svglUrl(svglEntry);
      svglHits++;
      continue;
    }

    // Tier 2: Simple Icons (alias map, then exact/alias match in SI data)
    const siAliasTitle = SI_ALIASES[item.name];
    if (siAliasTitle) {
      const slug = siSlug(siAliasTitle);
      if (siSlugs.has(slug)) {
        item.image = siCdnUrl(slug);
        siHits++;
        continue;
      }
    }

    const siTitle = siTitleMap.get(item.name.toLowerCase());
    if (siTitle) {
      const slug = siSlug(siTitle);
      if (siSlugs.has(slug)) {
        item.image = siCdnUrl(slug);
        siHits++;
        continue;
      }
    }

    misses++;
  }

  console.log(`Results:`);
  console.log(`  Manual overrides: ${manualHits}`);
  console.log(`  SVGL matches:    ${svglHits}`);
  console.log(`  SI matches:      ${siHits}`);
  console.log(`  No image:        ${misses}`);
  console.log(`  Total:           ${items.length}`);

  if (misses > 0) {
    console.log(`\nItems without images:`);
    for (const item of items) {
      if (!item.image) console.log(`  - ${item.name} [${item.tags.join(', ')}]`);
    }
  }

  // Write output
  const lines = items.map((item) => {
    const img = item.image ? JSON.stringify(item.image) : 'null';
    return `  { itemSlug: ${JSON.stringify(item.slug)}, itemName: ${JSON.stringify(item.name)}, tags: ${JSON.stringify(item.tags)}, itemImage: ${img} }`;
  });

  const output = [
    'type Item = {',
    '  itemSlug: string;',
    '  itemName: string;',
    '  tags: string[];',
    '  itemImage: string | null;',
    '};',
    '',
    'export const items: Item[] = [',
    lines.join(',\n') + ',',
    '];',
    '',
  ].join('\n');

  writeFileSync(ITEMS_PATH, output);
  console.log(`\nWrote ${ITEMS_PATH}`);
}

main().catch(console.error);
