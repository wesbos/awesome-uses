import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { $searchItems, $mergeItems } from '../../server/fn/items';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/admin/merge')({
  component: MergePage,
});

function MergePage() {
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemSearchResults, setItemSearchResults] = useState<
    Array<{ item: string; itemSlug: string; count: number }>
  >([]);
  const [searchingItems, setSearchingItems] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [canonicalItem, setCanonicalItem] = useState('');
  const [sourceItems, setSourceItems] = useState<string[]>([]);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeResult, setMergeResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function runItemSearch() {
    setSearchingItems(true);
    setSearchError(null);
    setItemSearchResults([]);
    try {
      const results = await $searchItems({ data: itemSearchQuery });
      if (!Array.isArray(results)) {
        throw new Error(`Unexpected response from server: ${JSON.stringify(results)}`);
      }
      setItemSearchResults(results);
      if (results.length === 0 && itemSearchQuery.trim()) {
        setSearchError(`No items found matching "${itemSearchQuery}"`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed — unknown error';
      setSearchError(message);
    } finally {
      setSearchingItems(false);
    }
  }

  async function applyMerge() {
    if (!canonicalItem || sourceItems.length === 0) return;
    setMergeBusy(true);
    setMergeResult(null);
    try {
      const result = await $mergeItems({
        data: { canonicalItem, sourceItems },
      });
      setMergeResult({
        ok: true,
        message: `Merged ${result.mergedItems.length} items into "${result.canonicalItem}" (${result.upsertedRows} row updates, ${result.deletedRows} source rows removed).`,
      });
      await runItemSearch();
      setSourceItems([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to merge items.';
      setMergeResult({ ok: false, message });
    } finally {
      setMergeBusy(false);
    }
  }

  function toggleSourceItem(item: string) {
    setSourceItems((prev) =>
      prev.includes(item) ? prev.filter((entry) => entry !== item) : [...prev, item]
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-medium">Merge items into one</h4>
          <div className="flex gap-2">
            <Input
              value={itemSearchQuery}
              onChange={(e) => setItemSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runItemSearch()}
              placeholder="Search items..."
            />
            <Button onClick={runItemSearch} disabled={searchingItems || !itemSearchQuery.trim()}>
              {searchingItems ? 'Searching...' : 'Search'}
            </Button>
          </div>
          {searchError && (
            <p className="text-xs text-destructive">{searchError}</p>
          )}
          <Input
            value={canonicalItem}
            onChange={(e) => setCanonicalItem(e.target.value)}
            placeholder="Canonical item name"
          />
          {itemSearchResults.length > 0 && (
            <div className="max-h-56 overflow-auto rounded-md border p-2 space-y-1">
              {itemSearchResults.map((entry) => (
                <label key={entry.itemSlug} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{entry.item} <span className="text-muted-foreground">({entry.count})</span></span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={() => setCanonicalItem(entry.item)}
                    >
                      set main
                    </button>
                    <input
                      type="checkbox"
                      checked={sourceItems.includes(entry.item)}
                      onChange={() => toggleSourceItem(entry.item)}
                      disabled={canonicalItem === entry.item}
                    />
                  </div>
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Merge sources: {sourceItems.join(', ') || 'none selected'}
          </p>
          <Button
            onClick={applyMerge}
            disabled={mergeBusy || !canonicalItem || sourceItems.length === 0}
          >
            {mergeBusy ? 'Merging...' : 'Merge selected items'}
          </Button>
          {mergeResult && (
            <p className={`text-xs ${mergeResult.ok ? 'text-muted-foreground' : 'text-destructive font-medium'}`}>
              {mergeResult.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
