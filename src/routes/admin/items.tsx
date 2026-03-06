import { Link, createFileRoute } from '@tanstack/react-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { $getItemsDashboard, $enrichItems, type ItemsDashboardRow } from '../../server/fn/items';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const Route = createFileRoute('/admin/items')({
  component: ItemsPage,
});

const PAGE_SIZE = 100;

const ItemRow = memo(function ItemRow({
  row,
  isSelected,
  onToggle,
}: {
  row: ItemsDashboardRow;
  isSelected: boolean;
  onToggle: (item: string) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(row.item)}
          className="accent-primary"
        />
      </TableCell>
      <TableCell className="font-medium">
        <Link
          to="/items/$itemSlug"
          params={{ itemSlug: row.itemSlug }}
          className="hover:underline"
        >
          {row.item}
        </Link>
      </TableCell>
      <TableCell>
        {row.itemType ? (
          <Badge variant="outline" className="text-xs">{row.itemType}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {row.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
          {row.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{row.tags.length - 3}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">{row.count}</TableCell>
      <TableCell className="max-w-[250px] truncate text-xs text-muted-foreground">
        {row.description ?? '—'}
      </TableCell>
      <TableCell className="max-w-[200px] truncate">
        {row.itemUrl ? (
          <a href={row.itemUrl} target="_blank" rel="noreferrer noopener" className="text-xs hover:underline">
            {row.itemUrl}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
});

function ItemsPage() {
  const [items, setItems] = useState<ItemsDashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ done: 0, total: 0 });
  const [filterType, setFilterType] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await $getItemsDashboard();
        if (!cancelled) setItems(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const query = search.toLowerCase();
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (query && !item.item.toLowerCase().includes(query) && !item.tags.some((t) => t.toLowerCase().includes(query))) {
        return false;
      }
      if (filterType === 'enriched' && !item.enrichedAt) return false;
      if (filterType === 'unenriched' && item.enrichedAt) return false;
      if (filterType === 'product' && item.itemType !== 'product') return false;
      if (filterType === 'software' && item.itemType !== 'software') return false;
      if (filterType === 'service' && item.itemType !== 'service') return false;
      return true;
    });
  }, [items, query, filterType]);

  const visibleRows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, filterType]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= filtered.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, filtered.length]);

  const toggleSelected = useCallback((itemName: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) next.delete(itemName);
      else next.add(itemName);
      return next;
    });
  }, []);

  const allFilteredSelected = useMemo(
    () => filtered.length > 0 && filtered.every((r) => selected.has(r.item)),
    [filtered, selected],
  );

  function toggleAllFiltered() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        for (const r of filtered) next.delete(r.item);
        return next;
      }
      const next = new Set(prev);
      for (const r of filtered) next.add(r.item);
      return next;
    });
  }

  async function enrichSelected() {
    const selectedItems = items.filter((i) => selected.has(i.item));
    if (selectedItems.length === 0) return;

    setEnriching(true);
    setEnrichProgress({ done: 0, total: selectedItems.length });

    const BATCH_SIZE = 20;
    for (let i = 0; i < selectedItems.length; i += BATCH_SIZE) {
      const batch = selectedItems.slice(i, i + BATCH_SIZE);
      try {
        const results = await $enrichItems({
          data: {
            items: batch.map((item) => ({ item: item.item, tags: item.tags })),
          },
        });

        setItems((prev) =>
          prev.map((item) => {
            const result = results.find((r) => r.item === item.item);
            if (!result || result.error) return item;
            return {
              ...item,
              itemType: result.itemType,
              description: result.description,
              itemUrl: result.itemUrl,
              enrichedAt: new Date().toISOString(),
            };
          })
        );
      } catch {
        // continue with next batch
      }
      setEnrichProgress({ done: Math.min(i + BATCH_SIZE, selectedItems.length), total: selectedItems.length });
    }

    setEnriching(false);
    setSelected(new Set());
  }

  if (loading) return <p className="text-muted-foreground">Loading items...</p>;

  const enrichedCount = items.filter((i) => i.enrichedAt).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <span>Total: <strong className="text-foreground">{items.length}</strong></span>
        <span>Enriched: <strong className="text-foreground">{enrichedCount}</strong></span>
        <span>Unenriched: <strong className="text-foreground">{items.length - enrichedCount}</strong></span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'enriched', 'unenriched', 'product', 'software', 'service'] as const).map((mode) => (
          <Button
            key={mode}
            variant={filterType === mode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType(mode)}
            className="capitalize"
          >
            {mode}
          </Button>
        ))}
        <Input
          type="text"
          placeholder="Search items or tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px]"
        />
      </div>

      <div className="flex items-center gap-2">
        {selected.size > 0 && (
          <Button
            size="sm"
            onClick={enrichSelected}
            disabled={enriching}
          >
            {enriching
              ? `Enriching... ${enrichProgress.done}/${enrichProgress.total}`
              : `Enrich Selected (${selected.size})`}
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {visibleRows.length} of {filtered.length} items
        {filtered.length !== items.length && ` (${items.length} total)`}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAllFiltered}
                className="accent-primary"
              />
            </TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>People</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>URL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row) => (
            <ItemRow
              key={row.item}
              row={row}
              isSelected={selected.has(row.item)}
              onToggle={toggleSelected}
            />
          ))}
        </TableBody>
      </Table>

      {visibleCount < filtered.length && (
        <div ref={sentinelRef} className="py-4 text-center text-sm text-muted-foreground">
          Loading more...
        </div>
      )}
    </div>
  );
}
