import type { ExtractedItemType } from './ai';

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
  // MacBook variants -> MacBook {Pro,Air,Studio}
  [/^MacBook Pro\b.*$/i, 'MacBook Pro'],
  [/^MacBook Air\b.*$/i, 'MacBook Air'],
  [/^Mac Studio\b.*$/i, 'Mac Studio'],
  [/^Mac Mini\b.*$/i, 'Mac Mini'],
  [/^Mac Pro\b.*$/i, 'Mac Pro'],
  [/^iMac\b.*$/i, 'iMac'],
  // iPhone variants -> iPhone
  [/^iPhone\b.*$/i, 'iPhone'],
  // iPad variants -> iPad {Pro,Air,Mini}
  [/^iPad Pro\b.*$/i, 'iPad Pro'],
  [/^iPad Air\b.*$/i, 'iPad Air'],
  [/^iPad Mini\b.*$/i, 'iPad Mini'],
  [/^iPad\b.*$/i, 'iPad'],
  // AirPods variants
  [/^AirPods Pro\b.*$/i, 'AirPods Pro'],
  [/^AirPods Max\b.*$/i, 'AirPods Max'],
  [/^AirPods\b.*$/i, 'AirPods'],
  [/^Apple AirPods Pro\b.*$/i, 'AirPods Pro'],
  [/^Apple AirPods Max\b.*$/i, 'AirPods Max'],
  [/^Apple AirPods\b.*$/i, 'AirPods'],
  // HomePod
  [/^HomePod\b.*$/i, 'HomePod'],
  // Pixel variants -> Pixel
  [/^Pixel\b.*$/i, 'Pixel'],
  // Samsung Galaxy -> Galaxy
  [/^Samsung Galaxy\b.*$/i, 'Samsung Galaxy'],
  // Surface variants
  [/^Surface Laptop\b.*$/i, 'Surface Laptop'],
  [/^Surface Pro\b.*$/i, 'Surface Pro'],
];

// Strip year/generation suffixes and move to detail
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
  // Strip vague/contextual categories
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

  // Direct name replacements
  if (ITEM_NORMALIZATIONS[name]) {
    name = ITEM_NORMALIZATIONS[name];
  }

  // Regex model stripping (MacBook Pro 16-inch 2019 -> MacBook Pro)
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

  // Strip year/generation suffixes from item name -> detail
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

  // Normalize categories
  const categories = item.categories
    .map((c) => c.toLowerCase().trim())
    .map((c) => {
      if (c in CATEGORY_MERGES) return CATEGORY_MERGES[c];
      return c;
    })
    .filter((c): c is string => c !== null);

  const uniqueCategories = [...new Set(categories)];

  return {
    item: name,
    categories: uniqueCategories.length > 0 ? uniqueCategories : ['other'],
    detail,
  };
}

export function normalizeItems(items: ExtractedItemType[]): ExtractedItemType[] {
  return items.map(normalizeItem);
}
