import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { FacePile } from '@/components/FacePile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTagBySlug } from '../lib/data';
import { $getTagDetail, $trackView, type TagDetailWithFaces } from '../server/functions';
import { buildMeta, SITE_URL, ogImageUrl } from '../lib/seo';

export const Route = createFileRoute('/tags/$tagSlug')({
  head: ({ params }) => {
    const tagName = params.tagSlug.replace(/-/g, ' ');
    return buildMeta({
      title: tagName,
      description: `Developers and tools tagged with "${tagName}".`,
      ogImage: ogImageUrl({ title: tagName, subtitle: 'Tag' }),
      canonical: `${SITE_URL}/tags/${params.tagSlug}`,
    });
  },
  component: TagDetailPage,
});

function TagDetailPage() {
  const { tagSlug } = Route.useParams();
  const [detail, setDetail] = useState<TagDetailWithFaces | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await $getTagDetail({ data: tagSlug });
        if (!cancelled) setDetail(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tagSlug]);

  useEffect(() => {
    if (!detail) return;
    void $trackView({
      data: {
        entityType: 'tag',
        entityKey: detail.tagSlug,
        route: `/tags/${detail.tagSlug}`,
      },
    });
  }, [detail]);

  if (loading) {
    return <p className="text-muted-foreground">Loading tag details...</p>;
  }

  if (!detail) {
    const canonicalTag = getTagBySlug(tagSlug);
    return (
      <div className="space-y-4">
        <Link to="/tags" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to extracted tags
        </Link>
        <p className="text-muted-foreground">No extracted tag found for this slug.</p>
        {canonicalTag && (
          <p className="text-sm text-muted-foreground">
            This slug matches a directory tag:{' '}
            <Link
              to="/like/$tag"
              params={{ tag: canonicalTag.name }}
              className="underline hover:text-foreground"
            >
              {canonicalTag.name}
            </Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link to="/tags" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to extracted tags
        </Link>
        <h2 className="text-2xl font-semibold">{detail.tag}</h2>
        <p className="text-sm text-muted-foreground">
          {detail.totalPeople} people · {detail.totalItems} items
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">People using this tag</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.faces.length > 0 ? (
            <FacePile faces={detail.faces} max={40} size="md" />
          ) : (
            <p className="text-sm text-muted-foreground">No people found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items in this tag</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items found.</p>
          ) : (
            <ol className="space-y-2">
              {detail.items.map((item) => (
                <li key={item.itemSlug} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/items/$itemSlug"
                      params={{ itemSlug: item.itemSlug }}
                      className="hover:underline"
                    >
                      {item.item}
                    </Link>
                    <span className="text-xs text-muted-foreground ml-2">({item.count})</span>
                  </div>
                  <FacePile faces={item.faces} max={6} />
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
