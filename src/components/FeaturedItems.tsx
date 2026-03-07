import { Link } from '@tanstack/react-router';
import { ItemIcon } from './ItemIcon';
import type { FeaturedItemsByType, FeaturedItemRow } from '../server/fn/items';

type FeaturedItemsProps = {
  featured: FeaturedItemsByType;
};

const sections: Array<{
  key: keyof FeaturedItemsByType;
  label: string;
  icon: string;
}> = [
  { key: 'product', label: 'Top Products', icon: '🖥' },
  { key: 'software', label: 'Top Software', icon: '💿' },
  { key: 'service', label: 'Top Services', icon: '☁️' },
];

function ItemRow({ item }: { item: FeaturedItemRow }) {
  return (
    <li>
      <Link
        to="/items/$itemSlug"
        params={{ itemSlug: item.itemSlug }}
        className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
      >
        <ItemIcon itemSlug={item.itemSlug} className="h-4 w-4" />
        <span className="flex-1 truncate text-sm font-medium group-hover:text-foreground">
          {item.itemName}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {item.count}
        </span>
      </Link>
    </li>
  );
}

function FeaturedColumn({
  label,
  icon,
  items,
}: {
  label: string;
  icon: string;
  items: FeaturedItemRow[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{icon}</span>
        {label}
      </h3>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <ItemRow key={item.itemSlug} item={item} />
        ))}
      </ul>
    </div>
  );
}

export function FeaturedItems({ featured }: FeaturedItemsProps) {
  const hasAny =
    featured.product.length > 0 ||
    featured.software.length > 0 ||
    featured.service.length > 0;

  if (!hasAny) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold">Popular Items</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ key, label, icon }) => (
          <FeaturedColumn
            key={key}
            label={label}
            icon={icon}
            items={featured[key]}
          />
        ))}
      </div>
    </section>
  );
}
