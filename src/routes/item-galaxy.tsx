import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  GalaxyControlPanel,
  GalaxyCanvas,
  ClusterLegend,
  CLUSTER_COLORS,
  type GalaxyPoint,
} from '../components/galaxy';
import {
  $getItemGalaxyData,
  $batchVectorizeItems,
  $semanticItemSearch,
  type ItemGalaxyData,
  type BatchVectorizeItemsResult,
  type SemanticSearchResult,
} from '../server/fn/items';

const searchSchema = z.object({
  clusters: z.number().min(2).max(30).default(10).catch(10),
  neighbors: z.number().min(2).max(50).default(15).catch(15),
  minDist: z.number().min(0).max(1).default(0.1).catch(0.1),
  spread: z.number().min(0.5).max(3).default(1.0).catch(1.0),
  clusterOn: z.enum(['embeddings', 'umap']).default('embeddings').catch('embeddings'),
});

export const Route = createFileRoute('/item-galaxy')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const data = await $getItemGalaxyData({
      data: {
        clusters: deps.clusters,
        neighbors: deps.neighbors,
        minDist: deps.minDist,
        spread: deps.spread,
        clusterOn: deps.clusterOn,
      },
    });
    return data;
  },
  component: ItemGalaxyPage,
});

type ItemPoint = GalaxyPoint & {
  itemName: string;
  itemType: string | null;
  description: string | null;
  count: number;
  tags: string[];
};

function toCanvasPoints(points: ItemGalaxyData['points']): ItemPoint[] {
  return points.map((p) => ({
    ...p,
    size: p.count,
    label: p.itemName,
    href: `/items/${p.itemSlug}`,
  }));
}

function toClusterData(clusters: ItemGalaxyData['clusters']) {
  return clusters.map((c) => ({
    id: c.id,
    count: c.count,
    topLabels: c.topItems,
    allLabels: c.allItems,
  }));
}

const renderItemTooltip = (d: ItemPoint, clusterColor: string): string => `
  <div>
    <div class="font-medium text-sm">${d.itemName}</div>
    ${d.description ? `<div class="text-xs text-muted-foreground line-clamp-2">${d.description}</div>` : ''}
    <div class="flex items-center gap-1 mt-1">
      ${d.itemType ? `<span class="text-[10px] px-1 py-0 rounded border">${d.itemType}</span>` : ''}
      <span class="text-[10px] text-muted-foreground">${d.count} users</span>
    </div>
  </div>
`;

function ItemGalaxyPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [highlightedCluster, setHighlightedCluster] = useState<number | null>(null);

  if (!data.points.length) {
    return (
      <div className="space-y-4">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to directory
        </Link>
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">
              {data.vectorCount === 0
                ? 'No items have been vectorized yet. Use the button below to vectorize the top 1000 items.'
                : `Only ${data.vectorCount} items vectorized. Need at least 5.`}
            </p>
            <VectorizeButton />
          </CardContent>
        </Card>
      </div>
    );
  }

  const canvasPoints = toCanvasPoints(data.points);
  const clusterData = toClusterData(data.clusters);

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        &larr; Back to directory
      </Link>
      <h2 className="text-xl font-semibold">Item Galaxy</h2>
      <p className="text-sm text-muted-foreground">
        Each dot is a tool, product, or service. Similar items cluster together.
        Bigger dots = more users. Adjust the knobs below to tune the grouping.
      </p>
      <SemanticSearch />
      <GalaxyControlPanel
        search={search}
        onSubmit={(values) => navigate({ search: values })}
        maxClusters={30}
        maxNeighbors={50}
      />
      <GalaxyCanvas
        points={canvasPoints}
        highlightedCluster={highlightedCluster}
        onHighlight={setHighlightedCluster}
        renderTooltip={renderItemTooltip}
      />
      <ClusterLegend
        clusters={clusterData}
        highlightedCluster={highlightedCluster}
        onHighlight={setHighlightedCluster}
        itemLabel="items"
      />
      <div className="flex items-center gap-2">
        <VectorizeButton />
        <span className="text-xs text-muted-foreground">{data.vectorCount} items vectorized</span>
      </div>
    </div>
  );
}

function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    try {
      const res = await $semanticItemSearch({ data: trimmed });
      setResults(res);
    } catch (err) {
      console.log('[SemanticSearch] search failed:', err);
      setResults([]);
    }
    setSearching(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Semantic Search</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Type a category, description, or concept and find the closest items by embedding similarity.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex gap-2"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. mechanical keyboards, note-taking apps, audio recording..."
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={searching || !query.trim()}>
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </form>
        {results && results.length > 0 && (
          <div className="space-y-1.5">
            {results.map((r) => (
              <a
                key={r.itemSlug}
                href={`/items/${r.itemSlug}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium">{r.itemName}</span>
                  {r.description && (
                    <span className="text-xs text-muted-foreground ml-2 line-clamp-1">{r.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.itemType && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{r.itemType}</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground tabular-nums">{r.score}</span>
                  <span className="text-[10px] text-muted-foreground">{r.count} users</span>
                </div>
              </a>
            ))}
          </div>
        )}
        {results && results.length === 0 && (
          <p className="text-xs text-muted-foreground">No results found.</p>
        )}
      </CardContent>
    </Card>
  );
}

function VectorizeButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BatchVectorizeItemsResult | null>(null);

  async function handleClick() {
    setBusy(true);
    setResult(null);
    try {
      const res = await $batchVectorizeItems({ data: { limit: 1000, skipExisting: true } });
      setResult(res);
    } catch (err) {
      console.log('[VectorizeButton] vectorize failed:', err);
      setResult({ processed: 0, vectorized: 0, errors: 1 });
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handleClick} disabled={busy}>
        {busy ? 'Vectorizing...' : 'Vectorize Top 1000 Items'}
      </Button>
      {result && (
        <span className="text-xs text-muted-foreground">
          {result.vectorized} vectorized, {result.errors} errors
        </span>
      )}
    </div>
  );
}
