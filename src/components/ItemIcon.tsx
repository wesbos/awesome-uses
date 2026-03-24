import { items } from '../generated/items';

type ItemImageEntry = {
  src: string;
  kind: 'mono-black' | 'mono-white' | 'color';
};

function classifyImage(url: string): ItemImageEntry['kind'] {
  if (url.includes('cdn.jsdelivr.net/npm/simple-icons')) return 'mono-black';
  if (url.includes('_dark.svg')) return 'mono-white';
  return 'color';
}

const imageBySlug = new Map<string, ItemImageEntry>(
  items
    .filter((i) => i.itemImage)
    .map((i) => [i.itemSlug, { src: i.itemImage!, kind: classifyImage(i.itemImage!) }])
);

const kindClass: Record<ItemImageEntry['kind'], string> = {
  'mono-black': 'dark:invert',
  'mono-white': 'invert dark:invert-0',
  'color': '',
};

type ItemIconProps = {
  itemSlug: string;
  className?: string;
};

export function ItemIcon({ itemSlug, className }: ItemIconProps) {
  const entry = imageBySlug.get(itemSlug);
  if (!entry) return null;
  return (
    <img
      src={entry.src}
      alt=""
      loading="lazy"
      className={`${className ?? 'h-3 w-3'} shrink-0 ${kindClass[entry.kind]}`}
    />
  );
}
