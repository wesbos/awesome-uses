import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CLUSTER_COLORS } from './constants';

type ClusterData = {
  id: number;
  count: number;
  topLabels: string[];
  allLabels: string[];
};

export function ClusterLegend({
  clusters,
  highlightedCluster,
  onHighlight,
  itemLabel = 'items',
}: {
  clusters: ClusterData[];
  highlightedCluster: number | null;
  onHighlight: (id: number | null) => void;
  itemLabel?: string;
}) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  function copyCluster(cluster: ClusterData) {
    const text = cluster.allLabels.join('\n');
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
                    <p className="text-sm font-medium">{c.topLabels.slice(0, 3).join(', ')}</p>
                    <button
                      onClick={() => copyCluster(c)}
                      className="text-[10px] text-muted-foreground hover:text-foreground shrink-0"
                      title={`Copy all ${c.allLabels.length} ${itemLabel}`}
                    >
                      {copiedId === c.id ? 'Copied!' : `Copy ${c.allLabels.length}`}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.count} {itemLabel}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.topLabels.slice(0, 10).map((label) => (
                      <Badge key={label} variant="outline" className="text-[10px] px-1 py-0">
                        {label}
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
