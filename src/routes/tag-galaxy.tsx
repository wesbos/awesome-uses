import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  GalaxyControlPanel,
  GalaxyCanvas,
  ClusterLegend,
  type GalaxyPoint,
} from '../components/galaxy';
import {
  $getTagGalaxyData,
  $batchVectorizeTags,
  type TagGalaxyData,
  type BatchVectorizeTagsResult,
} from '../server/fn/tags';

const searchSchema = z.object({
  clusters: z.number().min(2).max(20).default(6).catch(6),
  neighbors: z.number().min(2).max(30).default(5).catch(5),
  minDist: z.number().min(0).max(1).default(0.1).catch(0.1),
  spread: z.number().min(0.5).max(3).default(1.0).catch(1.0),
  clusterOn: z.enum(['embeddings', 'umap']).default('embeddings').catch('embeddings'),
});

export const Route = createFileRoute('/tag-galaxy')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const data = await $getTagGalaxyData({
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
  component: TagGalaxyPage,
});

type TagPoint = GalaxyPoint & {
  tagName: string;
  totalItems: number;
  totalPeople: number;
  topItems: string[];
};

function toCanvasPoints(points: TagGalaxyData['points']): TagPoint[] {
  return points.map((p) => ({
    ...p,
    size: p.totalPeople,
    label: p.tagName,
    href: `/tags/${p.tagSlug}`,
  }));
}

function toClusterData(clusters: TagGalaxyData['clusters']) {
  return clusters.map((c) => ({
    id: c.id,
    count: c.count,
    topLabels: c.topTags,
    allLabels: c.allTags,
  }));
}

const renderTagTooltip = (d: TagPoint): string => `
  <div>
    <div class="font-medium text-sm">${d.tagName}</div>
    <div class="text-xs text-muted-foreground">${d.totalPeople} people, ${d.totalItems} items</div>
    ${d.topItems.length > 0 ? `<div class="text-[10px] text-muted-foreground mt-1">e.g. ${d.topItems.join(', ')}</div>` : ''}
  </div>
`;

function TagGalaxyPage() {
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
                ? 'No tags have been vectorized yet. Use the button below to vectorize all tags.'
                : `Only ${data.vectorCount} tags vectorized. Need at least 5.`}
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
      <h2 className="text-xl font-semibold">Tag Galaxy</h2>
      <p className="text-sm text-muted-foreground">
        Each dot is a tag (e.g. keyboard, editor, language). Similar tags cluster together.
        Bigger dots = more people using items with that tag.
      </p>
      <GalaxyControlPanel
        search={search}
        onSubmit={(values) => navigate({ search: values })}
        maxClusters={20}
        maxNeighbors={30}
      />
      <GalaxyCanvas
        points={canvasPoints}
        highlightedCluster={highlightedCluster}
        onHighlight={setHighlightedCluster}
        renderTooltip={renderTagTooltip}
        showLabels
      />
      <ClusterLegend
        clusters={clusterData}
        highlightedCluster={highlightedCluster}
        onHighlight={setHighlightedCluster}
        itemLabel="tags"
      />
      <div className="flex items-center gap-2">
        <VectorizeButton />
        <span className="text-xs text-muted-foreground">{data.vectorCount} tags vectorized</span>
      </div>
    </div>
  );
}

function VectorizeButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BatchVectorizeTagsResult | null>(null);

  async function handleClick() {
    setBusy(true);
    setResult(null);
    try {
      const res = await $batchVectorizeTags({ data: { skipExisting: true } });
      setResult(res);
    } catch (err) {
      console.log('[VectorizeButton] tag vectorize failed:', err);
      setResult({ processed: 0, vectorized: 0, errors: 1 });
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handleClick} disabled={busy}>
        {busy ? 'Vectorizing...' : 'Vectorize All Tags'}
      </Button>
      {result && (
        <span className="text-xs text-muted-foreground">
          {result.vectorized} vectorized, {result.errors} errors
        </span>
      )}
    </div>
  );
}
