import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
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

type EnrichedMember = {
  personSlug: string;
  name: string;
  avatarUrl: string | null;
  description: string | null;
};

type EnrichedCluster = {
  id: number;
  label: string;
  topItems: string[];
  count: number;
  color: string;
  members: EnrichedMember[];
};

export const Route = createFileRoute('/discover')({
  loader: async () => {
    const galaxyData = await $getGalaxyData();
    if (!galaxyData.points.length) return null;
    const people = getAllPeople();
    const peopleMap = new Map(people.map((p) => [p.personSlug, p]));

    const membersByCluster = new Map<number, EnrichedMember[]>();
    for (const pt of galaxyData.points) {
      const person = peopleMap.get(pt.personSlug);
      const member: EnrichedMember = {
        personSlug: pt.personSlug,
        name: person?.name ?? pt.personSlug,
        avatarUrl: person ? getAvatarUrl(person) : null,
        description: person?.description ?? null,
      };
      if (!membersByCluster.has(pt.cluster)) membersByCluster.set(pt.cluster, []);
      membersByCluster.get(pt.cluster)!.push(member);
    }

    const clusters: EnrichedCluster[] = galaxyData.clusters.map((c) => ({
      ...c,
      color: CLUSTER_COLORS[c.id % CLUSTER_COLORS.length],
      members: membersByCluster.get(c.id) ?? [],
    }));

    return { clusters };
  },
  component: DiscoverPage,
});

function DiscoverPage() {
  const data = Route.useLoaderData();
  const [expandedCluster, setExpandedCluster] = useState<number | null>(null);

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
    <div className="space-y-6">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        &larr; Back to directory
      </Link>
      <div>
        <h2 className="text-xl font-semibold">Discover Developers</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Developers grouped by the similarity of their /uses pages. Each cluster shares common tools and preferences.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.clusters.map((cluster) => (
          <ClusterCard
            key={cluster.id}
            cluster={cluster}
            expanded={expandedCluster === cluster.id}
            onToggle={() => setExpandedCluster(expandedCluster === cluster.id ? null : cluster.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ClusterCard({
  cluster,
  expanded,
  onToggle,
}: {
  cluster: EnrichedCluster;
  expanded: boolean;
  onToggle: () => void;
}) {
  const previewMembers = cluster.members.slice(0, expanded ? 30 : 6);

  return (
    <Card className={expanded ? 'sm:col-span-2 lg:col-span-3' : ''}>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: cluster.color }}
          />
          <CardTitle className="text-base flex-1">{cluster.label}</CardTitle>
          <span className="text-xs text-muted-foreground">{cluster.count} people</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {cluster.topItems.map((item) => (
            <Badge key={item} variant="outline" className="text-xs">
              {item}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-2 ${expanded ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {previewMembers.map((member) => (
            <Link
              key={member.personSlug}
              to="/people/$personSlug"
              params={{ personSlug: member.personSlug }}
              className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/40 transition-colors"
            >
              {member.avatarUrl && (
                <img
                  src={member.avatarUrl}
                  alt={member.name}
                  loading="lazy"
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{member.name}</p>
                {member.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{member.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
        {cluster.members.length > previewMembers.length && (
          <button
            onClick={onToggle}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? 'Show less' : `+ ${cluster.members.length - previewMembers.length} more`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
