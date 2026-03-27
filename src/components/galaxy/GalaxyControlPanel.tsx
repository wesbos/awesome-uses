import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SliderControl } from './SliderControl';

export type GalaxySearchParams = {
  clusters: number;
  neighbors: number;
  minDist: number;
  spread: number;
  clusterOn: 'embeddings' | 'umap';
};

export function GalaxyControlPanel({
  search,
  onSubmit,
  maxClusters = 30,
  maxNeighbors = 50,
}: {
  search: GalaxySearchParams;
  onSubmit: (values: GalaxySearchParams) => void;
  maxClusters?: number;
  maxNeighbors?: number;
}) {
  const [local, setLocal] = useState(search);
  const dirty = local.clusters !== search.clusters
    || local.neighbors !== search.neighbors
    || local.minDist !== search.minDist
    || local.spread !== search.spread
    || local.clusterOn !== search.clusterOn;

  return (
    <Card>
      <CardContent className="py-3 space-y-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SliderControl
            label="Clusters"
            description="How many groups to split into. Fewer = broader categories, more = finer distinctions."
            value={local.clusters}
            min={2}
            max={maxClusters}
            step={1}
            onChange={(v) => setLocal((s) => ({ ...s, clusters: v }))}
          />
          <SliderControl
            label="Neighbors"
            description="How many nearby points UMAP considers when placing dots. Low = tight local clumps, high = smoother global layout."
            value={local.neighbors}
            min={2}
            max={maxNeighbors}
            step={1}
            onChange={(v) => setLocal((s) => ({ ...s, neighbors: v }))}
          />
          <SliderControl
            label="Min Distance"
            description="How tightly dots can pack together. 0 = dots overlap freely, 1 = dots spread out evenly."
            value={local.minDist}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setLocal((s) => ({ ...s, minDist: v }))}
          />
          <SliderControl
            label="Spread"
            description="How much space between clusters. Low = compact clusters, high = clusters drift further apart."
            value={local.spread}
            min={0.5}
            max={3}
            step={0.1}
            onChange={(v) => setLocal((s) => ({ ...s, spread: v }))}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Cluster on</label>
            <div className="flex items-center gap-2">
              {(['embeddings', 'umap'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLocal((s) => ({ ...s, clusterOn: mode }))}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    local.clusterOn === mode
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {mode === 'embeddings' ? 'Full Embeddings' : 'UMAP 2D'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-tight">
              {local.clusterOn === 'embeddings'
                ? 'K-means runs on the full 1536-dim vectors. More semantically accurate, but colors may not match visual position.'
                : 'K-means runs on the 2D UMAP positions. Colors always match visual clusters, but loses some semantic nuance.'}
            </p>
          </div>
          <Button size="sm" onClick={() => onSubmit(local)} disabled={!dirty} className="self-start mt-4">
            Apply
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
