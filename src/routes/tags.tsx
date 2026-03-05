import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { $getTagSummaries, type TagSummaryWithFaces } from '../server/functions';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FacePile } from '@/components/FacePile';

export const Route = createFileRoute('/tags')({
  component: TagsPage,
});

function TagsPage() {
  const [tags, setTags] = useState<TagSummaryWithFaces[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await $getTagSummaries();
        if (!cancelled) setTags(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading tags...</p>;
  if (tags.length === 0)
    return (
      <p className="text-muted-foreground">
        No extracted items yet. Run the extract pipeline first.
      </p>
    );

  const query = search.toLowerCase();
  const filtered = query ? tags.filter((t) => t.tag.includes(query)) : tags;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to directory
        </Link>
      </div>

      <h2 className="text-xl font-semibold">Tags ({tags.length})</h2>

      <Input
        type="text"
        placeholder="Filter tags..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((tag) => (
          <TagCard key={tag.tag} tag={tag} />
        ))}
      </div>
    </div>
  );
}

function TagCard({ tag }: { tag: TagSummaryWithFaces }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-baseline justify-between">
          <CardTitle className="text-sm">{tag.tag}</CardTitle>
          <span className="text-xs text-muted-foreground">
            {tag.totalItems} item{tag.totalItems !== 1 ? 's' : ''}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2 text-sm">
          {tag.topItems.map(({ item, count, faces }) => (
            <li key={item} className="flex items-center justify-between gap-2">
              <span className="truncate">
                {item}{' '}
                <span className="text-muted-foreground">({count})</span>
              </span>
              <FacePile faces={faces} max={4} />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
