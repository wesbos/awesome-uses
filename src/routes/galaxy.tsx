import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAvatarUrl } from '../lib/avatar';
import { getAllPeople } from '../lib/data';
import { $getGalaxyData, type GalaxyData } from '../server/functions';

const CLUSTER_COLORS = [
  '#f472b6', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#818cf8',
  '#c084fc', '#f87171', '#34d399', '#60a5fa', '#a78bfa', '#fbbf24',
  '#e879f9', '#2dd4bf', '#f97316', '#84cc16',
];

export const Route = createFileRoute('/galaxy')({
  loader: async () => {
    const galaxyData = await $getGalaxyData();
    if (!galaxyData.points.length) return null;
    const people = getAllPeople();
    const peopleMap = new Map(people.map((p) => [p.personSlug, p]));
    const enriched = galaxyData.points.map((pt) => {
      const person = peopleMap.get(pt.personSlug);
      return {
        ...pt,
        name: person?.name ?? pt.personSlug,
        avatarUrl: person ? getAvatarUrl(person) : null,
        description: person?.description ?? null,
      };
    });
    return { points: enriched, clusters: galaxyData.clusters };
  },
  component: GalaxyPage,
});

type EnrichedPoint = {
  personSlug: string;
  x: number;
  y: number;
  cluster: number;
  name: string;
  avatarUrl: string | null;
  description: string | null;
};

function GalaxyPage() {
  const data = Route.useLoaderData();

  if (!data) {
    return (
      <div className="space-y-4">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to directory
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Not enough vectorized profiles yet. Scrape and vectorize at least 5 profiles from the dashboard.
            </p>
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
      <h2 className="text-xl font-semibold">Developer Galaxy</h2>
      <p className="text-sm text-muted-foreground">
        Each dot is a developer, positioned by the similarity of their /uses page.
        Developers who use similar tools cluster together. Click a dot to visit their profile.
      </p>
      <GalaxyCanvas points={data.points} clusters={data.clusters} />
      <ClusterLegend clusters={data.clusters} />
    </div>
  );
}

function ClusterLegend({ clusters }: { clusters: GalaxyData['clusters'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Clusters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clusters.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: CLUSTER_COLORS[c.id % CLUSTER_COLORS.length] }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.count} people</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.topItems.slice(0, 5).map((item) => (
                    <Badge key={item} variant="outline" className="text-[10px] px-1 py-0">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GalaxyCanvas({
  points,
  clusters,
}: {
  points: EnrichedPoint[];
  clusters: GalaxyData['clusters'];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
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

    g.selectAll('circle')
      .data(points)
      .join('circle')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y))
      .attr('r', 5)
      .attr('fill', (d) => CLUSTER_COLORS[d.cluster % CLUSTER_COLORS.length])
      .attr('fill-opacity', 0.8)
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => {
        tooltip
          .style('opacity', '1')
          .html(`
            <div class="flex items-center gap-2">
              ${d.avatarUrl ? `<img src="${d.avatarUrl}" class="h-8 w-8 rounded-full" />` : ''}
              <div>
                <div class="font-medium text-sm">${d.name}</div>
                ${d.description ? `<div class="text-xs text-muted-foreground line-clamp-1">${d.description}</div>` : ''}
                <div class="text-[10px] mt-0.5" style="color:${CLUSTER_COLORS[d.cluster % CLUSTER_COLORS.length]}">${clusters.find((c) => c.id === d.cluster)?.label ?? ''}</div>
              </div>
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
        tooltip.style('opacity', '0');
      })
      .on('click', (_event, d) => {
        window.location.href = `/people/${d.personSlug}`;
      });

  }, [points, clusters, dimensions]);

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
