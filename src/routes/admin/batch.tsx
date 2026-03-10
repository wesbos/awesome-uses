import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { BatchExtractResult, BatchVectorizeResult } from '../../server/fn/vectorize';
import type { DuplicateGroup } from '../../server/fn/items';
import {
  apiBatchExtractItems,
  apiBatchVectorize,
  apiFindDuplicateItems,
  apiMergeItems,
} from '../../lib/site-management-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/admin/batch')({
  component: BatchPage,
});

function BatchPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <BatchExtractCard />
        <BatchVectorizeCard />
      </div>
      <AutoMergeDupesCard />
    </div>
  );
}

function BatchExtractCard() {
  const [limit, setLimit] = useState(50);
  const [skipExisting, setSkipExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BatchExtractResult | null>(null);
  const extractMutation = useMutation({
    mutationFn: apiBatchExtractItems,
  });

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await extractMutation.mutateAsync({ limit, skipExisting });
      setResult(res);
    } catch (err) {
      setResult({ processed: 0, totalItems: 0, errors: 1, results: [{ personSlug: '', itemCount: 0, error: err instanceof Error ? err.message : 'Failed' }] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h4 className="font-medium">Batch Extract Items</h4>
        <p className="text-xs text-muted-foreground">
          Run AI extraction on already-scraped pages to populate person_items.
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 50)}
            className="w-24"
          />
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
              className="accent-primary"
            />
            Skip already-extracted
          </label>
          <Button onClick={run} disabled={busy} size="sm">
            {busy ? 'Extracting...' : 'Run'}
          </Button>
        </div>
        {result && (
          <div className="text-xs space-y-1">
            <p>Processed: <strong>{result.processed}</strong> | Items: <strong>{result.totalItems}</strong> | Errors: <strong>{result.errors}</strong></p>
            {result.results.length > 0 && result.results.length <= 20 && (
              <div className="max-h-40 overflow-auto rounded-md border p-2 space-y-0.5">
                {result.results.map((r) => (
                  <div key={r.personSlug} className="flex justify-between">
                    <span className="truncate">{r.personSlug}</span>
                    <span className={r.error ? 'text-destructive' : 'text-muted-foreground'}>
                      {r.error || `${r.itemCount} items`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BatchVectorizeCard() {
  const [limit, setLimit] = useState(100);
  const [skipExisting, setSkipExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BatchVectorizeResult | null>(null);
  const vectorizeMutation = useMutation({
    mutationFn: apiBatchVectorize,
  });

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await vectorizeMutation.mutateAsync({ limit, skipExisting });
      setResult(res);
    } catch {
      setResult({ processed: 0, vectorized: 0, errors: 1 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h4 className="font-medium">Batch Vectorize</h4>
        <p className="text-xs text-muted-foreground">
          Generate embeddings for profiles and upsert into Vectorize.
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 100)}
            className="w-24"
          />
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
              className="accent-primary"
            />
            Skip already-vectorized
          </label>
          <Button onClick={run} disabled={busy} size="sm">
            {busy ? 'Vectorizing...' : 'Run'}
          </Button>
        </div>
        {result && (
          <p className="text-xs">
            Processed: <strong>{result.processed}</strong> | Vectorized: <strong>{result.vectorized}</strong> | Errors: <strong>{result.errors}</strong>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AutoMergeDupesCard() {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<string | null>(null);
  const duplicatesMutation = useMutation({
    mutationFn: apiFindDuplicateItems,
  });
  const mergeMutation = useMutation({
    mutationFn: apiMergeItems,
  });

  async function scan() {
    setLoading(true);
    setGroups(null);
    setMergeResult(null);
    try {
      const result = await duplicatesMutation.mutateAsync();
      setGroups(result);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  async function mergeAll() {
    if (!groups || groups.length === 0) return;
    setMerging(true);
    setMergeResult(null);
    let merged = 0;
    let errors = 0;
    for (const group of groups) {
      try {
        await mergeMutation.mutateAsync({
          canonicalItem: group.canonical,
          sourceItems: group.variants.map((v) => v.item),
        });
        merged++;
      } catch {
        errors++;
      }
    }
    setMergeResult(`Merged ${merged} groups. Errors: ${errors}.`);
    setMerging(false);
    setGroups(null);
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h4 className="font-medium">Auto-Merge Duplicates</h4>
        <p className="text-xs text-muted-foreground">
          Detect items that differ only by case/whitespace and merge them.
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={scan} disabled={loading} size="sm">
            {loading ? 'Scanning...' : 'Scan for duplicates'}
          </Button>
          {groups && groups.length > 0 && (
            <Button onClick={mergeAll} disabled={merging} size="sm" variant="destructive">
              {merging ? 'Merging...' : `Merge all ${groups.length} groups`}
            </Button>
          )}
        </div>
        {mergeResult && <p className="text-xs text-muted-foreground">{mergeResult}</p>}
        {groups && groups.length === 0 && (
          <p className="text-xs text-muted-foreground">No duplicates found.</p>
        )}
        {groups && groups.length > 0 && (
          <div className="max-h-64 overflow-auto rounded-md border p-2 text-sm space-y-2">
            {groups.map((group) => (
              <div key={group.canonical} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-medium">{group.canonical}</span>
                <span className="text-muted-foreground text-xs">({group.canonicalCount})</span>
                <span className="text-muted-foreground text-xs">&larr;</span>
                {group.variants.map((v) => (
                  <span key={v.item} className="text-xs">
                    {v.item} <span className="text-muted-foreground">({v.count})</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
