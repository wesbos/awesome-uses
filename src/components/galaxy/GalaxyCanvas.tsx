import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { CLUSTER_COLORS } from './constants';

export type GalaxyPoint = {
  x: number;
  y: number;
  cluster: number;
  size: number;
  label: string;
  href: string;
};

export function GalaxyCanvas<T extends GalaxyPoint>({
  points,
  highlightedCluster,
  onHighlight,
  renderTooltip,
  showLabels = false,
}: {
  points: T[];
  highlightedCluster: number | null;
  onHighlight: (id: number | null) => void;
  renderTooltip: (point: T, clusterColor: string) => string;
  showLabels?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const circlesRef = useRef<d3.Selection<SVGCircleElement, T, SVGGElement, unknown> | null>(null);
  const labelsRef = useRef<d3.Selection<SVGTextElement, T, SVGGElement, unknown> | null>(null);
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

    const maxSize = d3.max(points, (d) => d.size) ?? 1;
    const radiusScale = d3.scaleSqrt().domain([0, maxSize]).range(showLabels ? [5, 20] : [3, 14]);

    const circles = g.selectAll<SVGCircleElement, T>('circle')
      .data(points)
      .join('circle')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y))
      .attr('r', (d) => radiusScale(d.size))
      .attr('fill', (d) => CLUSTER_COLORS[d.cluster % CLUSTER_COLORS.length])
      .attr('fill-opacity', 0.8)
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .style('transition', 'opacity 150ms')
      .on('mouseenter', (_event, d) => {
        onHighlight(d.cluster);
        const color = CLUSTER_COLORS[d.cluster % CLUSTER_COLORS.length];
        tooltip.style('opacity', '1').html(renderTooltip(d, color));
      })
      .on('mousemove', (event) => {
        const [mx, my] = d3.pointer(event, document.body);
        tooltip.style('left', `${mx + 12}px`).style('top', `${my - 10}px`);
      })
      .on('mouseleave', () => {
        onHighlight(null);
        tooltip.style('opacity', '0');
      })
      .on('click', (_event, d) => {
        window.location.href = d.href;
      });

    circlesRef.current = circles;

    if (showLabels) {
      const labels = g.selectAll<SVGTextElement, T>('text')
        .data(points)
        .join('text')
        .attr('x', (d) => xScale(d.x))
        .attr('y', (d) => yScale(d.y) - radiusScale(d.size) - 3)
        .attr('text-anchor', 'middle')
        .attr('fill', 'currentColor')
        .attr('class', 'text-muted-foreground')
        .attr('font-size', '10px')
        .attr('pointer-events', 'none')
        .style('transition', 'opacity 150ms')
        .text((d) => d.label);

      labelsRef.current = labels;
    }
  }, [points, dimensions, onHighlight, renderTooltip, showLabels]);

  useEffect(() => {
    const circles = circlesRef.current;
    const labels = labelsRef.current;
    if (!circles) return;

    if (highlightedCluster === null) {
      circles.style('opacity', null);
      labels?.style('opacity', null);
    } else {
      circles.style('opacity', (d) => d.cluster === highlightedCluster ? 1 : 0.1);
      labels?.style('opacity', (d) => d.cluster === highlightedCluster ? 1 : 0.1);
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
