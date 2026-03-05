import { Link, Outlet, createFileRoute, useLocation } from '@tanstack/react-router';
import { useState } from 'react';
import {
  $getTagSummaries,
  type TagSummaryWithFaces,
  type TagItemWithFaces,
} from '../server/functions';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FacePile } from '@/components/FacePile';
import { HIDDEN_TAGS } from '@/lib/constants';
import { ItemIcon } from '@/components/ItemIcon';
import { buildMeta, SITE_URL } from '../lib/seo';

type Face = { personSlug: string; name: string; avatarUrl: string };

type GroupedItem =
  | { kind: 'single'; item: TagItemWithFaces }
  | { kind: 'group'; prefix: string; totalCount: number; children: TagItemWithFaces[] };

function deduplicateFaces(faces: Face[]): Face[] {
  const seen = new Set<string>();
  return faces.filter((f) => {
    if (seen.has(f.personSlug)) return false;
    seen.add(f.personSlug);
    return true;
  });
}

const ARTICLES = new Set(['the', 'a', 'an']);

function groupByBrand(items: TagItemWithFaces[]): GroupedItem[] {
  const prefixCounts = new Map<string, number>();
  for (const { item } of items) {
    const spaceIdx = item.indexOf(' ');
    if (spaceIdx === -1) continue;
    const prefix = item.slice(0, spaceIdx);
    if (ARTICLES.has(prefix.toLowerCase())) continue;
    prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
  }

  const groupPrefixes = new Set(
    [...prefixCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([prefix]) => prefix),
  );

  const result: GroupedItem[] = [];
  const seen = new Set<string>();
  const consumed = new Set<string>();

  for (const entry of items) {
    const spaceIdx = entry.item.indexOf(' ');
    const prefix = spaceIdx !== -1 ? entry.item.slice(0, spaceIdx) : null;

    if (prefix && groupPrefixes.has(prefix)) {
      if (seen.has(prefix)) continue;
      seen.add(prefix);

      const children = items.filter(
        (i) => i.item === prefix || i.item.startsWith(prefix + ' '),
      );
      for (const c of children) consumed.add(c.item);
      const totalCount = children.reduce((sum, c) => sum + c.count, 0);
      result.push({ kind: 'group', prefix, totalCount, children });
    } else if (entry.item === prefix || consumed.has(entry.item)) {
      continue;
    } else if (!prefix && groupPrefixes.has(entry.item)) {
      if (seen.has(entry.item)) continue;
      seen.add(entry.item);

      const children = items.filter(
        (i) => i.item === entry.item || i.item.startsWith(entry.item + ' '),
      );
      for (const c of children) consumed.add(c.item);
      const totalCount = children.reduce((sum, c) => sum + c.count, 0);
      result.push({ kind: 'group', prefix: entry.item, totalCount, children });
    } else {
      result.push({ kind: 'single', item: entry });
    }
  }

  return result;
}

export const Route = createFileRoute('/tags')({
  head: ({ loaderData }) => {
    const count = loaderData?.tags?.length ?? 0;
    return buildMeta({
      title: 'Tags',
      description: `Browse ${count} extracted tags across developer /uses pages.`,
      canonical: `${SITE_URL}/tags`,
    });
  },
  loader: async () => {
    const tags = await $getTagSummaries();
    return { tags };
  },
  component: TagsPage,
});

function TagsPage() {
  const location = useLocation();
  if (location.pathname !== '/tags') {
    return <Outlet />;
  }

  const { tags } = Route.useLoaderData();
  const [search, setSearch] = useState('');

  if (tags.length === 0)
    return (
      <p className="text-muted-foreground">
        No extracted items yet. Run the extract pipeline first.
      </p>
    );

  const visibleTags = tags.filter((t) => !HIDDEN_TAGS.includes(t.tagSlug));
  const query = search.toLowerCase();
  const filtered = query ? visibleTags.filter((t) => t.tag.includes(query)) : visibleTags;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to directory
        </Link>
      </div>

      <h2 className="text-xl font-semibold">Tags ({visibleTags.length})</h2>

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
  const grouped = groupByBrand(tag.topItems);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-baseline justify-between">
          <CardTitle className="text-sm">
            <Link
              to="/tags/$tagSlug"
              params={{ tagSlug: tag.tagSlug }}
              className="hover:underline"
            >
              {tag.tag}
            </Link>
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {tag.totalItems} item{tag.totalItems !== 1 ? 's' : ''}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-1.5 text-sm">
          {grouped.map((entry) =>
            entry.kind === 'single' ? (
              <li
                key={entry.item.item}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate inline-flex items-center gap-1">
                  <ItemIcon itemSlug={entry.item.itemSlug} />
                  <Link
                    to="/items/$itemSlug"
                    params={{ itemSlug: entry.item.itemSlug }}
                    className="hover:underline"
                  >
                    {entry.item.item}
                  </Link>{' '}
                  <span className="text-muted-foreground">
                    ({entry.item.count})
                  </span>
                </span>
                <FacePile faces={entry.item.faces} max={4} />
              </li>
            ) : (
              <li key={entry.prefix}>
                <div className="flex items-center justify-between gap-2 font-medium">
                  <span className="truncate">{entry.prefix}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <FacePile
                      faces={deduplicateFaces(entry.children.flatMap((c) => c.faces))}
                      max={4}
                    />
                    <span className="text-muted-foreground text-xs">
                      {entry.totalCount}
                    </span>
                  </div>
                </div>
                <ol className="pl-3 mt-1 space-y-0.5 border-l border-border">
                  {entry.children.map((child) => (
                    <li
                      key={child.item}
                      className="flex items-center justify-between gap-2 text-muted-foreground"
                    >
                      <span className="truncate inline-flex items-center gap-1">
                        <ItemIcon itemSlug={child.itemSlug} />
                        <Link
                          to="/items/$itemSlug"
                          params={{ itemSlug: child.itemSlug }}
                          className="hover:underline"
                        >
                          {child.item.slice(entry.prefix.length + 1) ||
                            `${child.item}`}
                        </Link>
                      </span>
                      <span className="text-xs shrink-0">({child.count})</span>
                    </li>
                  ))}
                </ol>
              </li>
            ),
          )}
        </ol>
      </CardContent>
    </Card>
  );
}
