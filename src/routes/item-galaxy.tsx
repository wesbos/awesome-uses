import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, useCallback } from 'react';
import { z } from 'zod';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  $getItemGalaxyData,
  $batchVectorizeItems,
  type ItemGalaxyData,
  type BatchVectorizeItemsResult,
} from '../server/fn/items';

const CLUSTER_COLORS = [
  '#f472b6', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#818cf8',
  '#c084fc', '#f87171', '#34d399', '#60a5fa', '#a78bfa', '#fbbf24',
  '#e879f9', '#2dd4bf', '#f97316', '#84cc16',
];

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
      <ControlPanel
        search={search}
        onSubmit={(values) => navigate({ search: values })}
      />
      <ItemGalaxyCanvas points={data.points} clusters={data.clusters} highlightedCluster={highlightedCluster} onHighlight={setHighlightedCluster} />
      <ItemClusterLegend clusters={data.clusters} highlightedCluster={highlightedCluster} onHighlight={setHighlightedCluster} />
      <div className="flex items-center gap-2">
        <VectorizeButton />
        <span className="text-xs text-muted-foreground">{data.vectorCount} items vectorized</span>
      </div>
    </div>
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
    } catch {
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

type SearchParams = z.infer<typeof searchSchema>;

function ControlPanel({
  search,
  onSubmit,
}: {
  search: SearchParams;
  onSubmit: (values: SearchParams) => void;
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
            description="How many groups to split items into. Fewer = broader categories, more = finer distinctions."
            value={local.clusters}
            min={2}
            max={30}
            step={1}
            onChange={(v) => setLocal((s) => ({ ...s, clusters: v }))}
          />
          <SliderControl
            label="Neighbors"
            description="How many nearby items UMAP considers when placing dots. Low = tight local clumps, high = smoother global layout."
            value={local.neighbors}
            min={2}
            max={50}
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

function SliderControl({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <span className="text-xs font-mono tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-1.5"
      />
      <p className="text-[11px] text-muted-foreground/70 leading-tight">{description}</p>
    </div>
  );
}

function ItemClusterLegend({
  clusters,
  highlightedCluster,
  onHighlight,
}: {
  clusters: ItemGalaxyData['clusters'];
  highlightedCluster: number | null;
  onHighlight: (id: number | null) => void;
}) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  function copyCluster(cluster: ItemGalaxyData['clusters'][number]) {
    const text = cluster.allItems.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(cluster.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Clusters ({clusters.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clusters.map((c) => {
            const dimmed = highlightedCluster !== null && highlightedCluster !== c.id;
            return (
              <div
                key={c.id}
                className="flex items-start gap-2 rounded-md px-1 py-0.5 transition-opacity cursor-default"
                style={{ opacity: dimmed ? 0.25 : 1 }}
                onMouseEnter={() => onHighlight(c.id)}
                onMouseLeave={() => onHighlight(null)}
              >
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: CLUSTER_COLORS[c.id % CLUSTER_COLORS.length] }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium">{c.topItems.slice(0, 3).join(', ')}</p>
                    <button
                      onClick={() => copyCluster(c)}
                      className="text-[10px] text-muted-foreground hover:text-foreground shrink-0"
                      title={`Copy all ${c.allItems.length} items`}
                    >
                      {copiedId === c.id ? 'Copied!' : `Copy ${c.allItems.length}`}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.count} items</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.topItems.slice(0, 10).map((item) => (
                      <Badge key={item} variant="outline" className="text-[10px] px-1 py-0">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

type EnrichedPoint = ItemGalaxyData['points'][number];

function ItemGalaxyCanvas({
  points,
  clusters,
  highlightedCluster,
  onHighlight,
}: {
  points: EnrichedPoint[];
  clusters: ItemGalaxyData['clusters'];
  highlightedCluster: number | null;
  onHighlight: (id: number | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const circlesRef = useRef<d3.Selection<SVGCircleElement, EnrichedPoint, SVGGElement, unknown> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDimensions({ width, height: Math.max(400, Math.min(700, width * 0.65)) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Build the SVG once when data/dimensions change
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tooltipRef.current);
    if (!svg.node() || !tooltip.node()) return;

    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const xExtent = d3.extent(points, (d) => d.x) as [number, number];
    const yExtent = d3.extent(points, (d) => d.y) as [number, number];

    const xScale = d3.scaleLinear().domain(xExtent).range([0, innerW]).nice();
    const yScale = d3.scaleLinear().domain(yExtent).range([innerH, 0]).nice();

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.translate(margin.left, margin.top));
      });

    svg.call(zoom as any);

    const maxCount = d3.max(points, (d) => d.count) ?? 1;
    const radiusScale = d3.scaleSqrt().domain([0, maxCount]).range([3, 14]);

    const circles = g.selectAll<SVGCircleElement, EnrichedPoint>('circle')
      .data(points)
      .join('circle')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y))
      .attr('r', (d) => radiusScale(d.count))
      .attr('fill', (d) => CLUSTER_COLORS[d.cluster % CLUSTER_COLORS.length])
      .attr('fill-opacity', 0.8)
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .style('transition', 'opacity 150ms')
      .on('mouseenter', (_event, d) => {
        onHighlight(d.cluster);
        const clusterLabel = clusters.find((c) => c.id === d.cluster)?.topItems.slice(0, 3).join(', ') ?? '';
        tooltip
          .style('opacity', '1')
          .html(`
            <div>
              <div class="font-medium text-sm">${d.itemName}</div>
              ${d.description ? `<div class="text-xs text-muted-foreground line-clamp-2">${d.description}</div>` : ''}
              <div class="flex items-center gap-1 mt-1">
                ${d.itemType ? `<span class="text-[10px] px-1 py-0 rounded border">${d.itemType}</span>` : ''}
                <span class="text-[10px] text-muted-foreground">${d.count} users</span>
              </div>
              <div class="text-[10px] mt-0.5" style="color:${CLUSTER_COLORS[d.cluster % CLUSTER_COLORS.length]}">${clusterLabel}</div>
            </div>
          `);
      })
      .on('mousemove', (event) => {
        const [mx, my] = d3.pointer(event, document.body);
        tooltip
          .style('left', `${mx + 12}px`)
          .style('top', `${my - 10}px`);
      })
      .on('mouseleave', () => {
        onHighlight(null);
        tooltip.style('opacity', '0');
      })
      .on('click', (_event, d) => {
        window.location.href = `/items/${d.itemSlug}`;
      });

    circlesRef.current = circles;
  }, [points, clusters, dimensions, onHighlight]);

  // Update circle opacity when highlightedCluster changes (without rebuilding SVG)
  useEffect(() => {
    const circles = circlesRef.current;
    if (!circles) return;

    if (highlightedCluster === null) {
      circles.style('opacity', null);
    } else {
      circles.style('opacity', (d) => d.cluster === highlightedCluster ? 1 : 0.1);
    }
  }, [highlightedCluster]);

  return (
    <div ref={containerRef} className="relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="rounded-lg border bg-background"
      />
      <div
        ref={tooltipRef}
        className="fixed z-50 pointer-events-none rounded-md border bg-popover px-3 py-2 shadow-md opacity-0 transition-opacity"
        style={{ maxWidth: 280 }}
      />
    </div>
  );
}
