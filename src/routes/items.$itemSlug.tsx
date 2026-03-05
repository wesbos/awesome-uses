import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { FacePile } from '@/components/FacePile';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { $getItemDetail, $trackView, type ItemDetailWithFaces } from '../server/functions';

export const Route = createFileRoute('/items/$itemSlug')({
  component: ItemDetailPage,
});

function ItemDetailPage() {
  const { itemSlug } = Route.useParams();
  const [detail, setDetail] = useState<ItemDetailWithFaces | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await $getItemDetail({ data: itemSlug });
        if (!cancelled) setDetail(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [itemSlug]);

  useEffect(() => {
    if (!detail) return;
    void $trackView({
      data: {
        entityType: 'item',
        entityKey: detail.itemSlug,
        route: `/items/${detail.itemSlug}`,
      },
    });
  }, [detail]);

  if (loading) {
    return <p className="text-muted-foreground">Loading item details...</p>;
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Link to="/tags" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to extracted tags
        </Link>
        <p className="text-muted-foreground">No extracted item found for this slug.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link to="/tags" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to extracted tags
        </Link>
        <h2 className="text-2xl font-semibold">{detail.item}</h2>
        <p className="text-sm text-muted-foreground">
          Used by {detail.totalPeople} people
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">People using this item</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.faces.length > 0 ? (
            <FacePile faces={detail.faces} max={50} size="md" />
          ) : (
            <p className="text-sm text-muted-foreground">No people found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tags for this item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {detail.tags.map((tag) => (
              <Link key={tag.slug} to="/tags/$tagSlug" params={{ tagSlug: tag.slug }}>
                <Badge variant="outline">{tag.name}</Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Related by tag</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.tagRelations.length === 0 && (
            <p className="text-sm text-muted-foreground">No related tag data found.</p>
          )}
          {detail.tagRelations.map((relation) => (
            <div key={relation.tagSlug} className="space-y-2 border-b border-border pb-3 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <Link
                  to="/tags/$tagSlug"
                  params={{ tagSlug: relation.tagSlug }}
                  className="font-medium hover:underline"
                >
                  {relation.tag}
                </Link>
                <FacePile faces={relation.faces} max={6} />
              </div>
              {relation.relatedItems.length > 0 && (
                <ul className="space-y-1">
                  {relation.relatedItems.map((related) => (
                    <li key={related.itemSlug} className="flex items-center justify-between gap-3 text-sm">
                      <Link
                        to="/items/$itemSlug"
                        params={{ itemSlug: related.itemSlug }}
                        className="truncate hover:underline"
                      >
                        {related.item}
                      </Link>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {related.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Amazon product matches</CardTitle>
        </CardHeader>
        <CardContent>
          {!detail.amazon.configured && (
            <p className="text-sm text-muted-foreground">
              Amazon product search is not configured.
            </p>
          )}
          {detail.amazon.configured && detail.amazon.error && (
            <p className="text-sm text-muted-foreground">{detail.amazon.error}</p>
          )}
          {detail.amazon.configured && !detail.amazon.error && detail.amazon.products.length === 0 && (
            <p className="text-sm text-muted-foreground">No Amazon matches found.</p>
          )}
          {detail.amazon.products.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {detail.amazon.products.map((product) => (
                <a
                  key={product.asin}
                  href={product.detailPageUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-md border p-3 hover:bg-muted/40 transition-colors"
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      loading="lazy"
                      className="h-36 w-full object-contain mb-2"
                    />
                  ) : (
                    <div className="h-36 w-full bg-muted rounded mb-2" />
                  )}
                  <p className="text-sm font-medium line-clamp-2">{product.title}</p>
                  {product.price && (
                    <p className="text-xs text-muted-foreground mt-1">{product.price}</p>
                  )}
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
