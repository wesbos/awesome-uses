import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { FacePile } from '@/components/FacePile';
import { getCompanyLogo } from '@/lib/company-logos';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await $getItemDetail({ data: itemSlug });
        if (!cancelled) {
          setDetail(result ? (JSON.parse(result) as ItemDetailWithFaces) : null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load item detail.');
          setDetail(null);
        }
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
        {error && (
          <p className="text-sm text-muted-foreground">
            {error}
          </p>
        )}
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
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold">{detail.item}</h2>
          {detail.itemType && (
            <Badge variant="outline" className="text-xs capitalize">{detail.itemType}</Badge>
          )}
        </div>
        {detail.description && (
          <p className="text-sm text-muted-foreground">{detail.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Used by {detail.totalPeople} people</span>
          {detail.itemUrl && (
            <a
              href={detail.itemUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary hover:underline"
            >
              {(() => { try { return new URL(detail.itemUrl).hostname; } catch { return detail.itemUrl; } })()}
            </a>
          )}
        </div>
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

      {detail.itemType === 'product' && <Card>
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
                <AmazonProductCard key={product.asin} product={product} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>}
    </div>
  );
}

function AmazonProductCard({
  product,
}: {
  product: ItemDetailWithFaces['amazon']['products'][number];
}) {
  const logo = product.brand ? getCompanyLogo(product.brand) : null;

  return (
    <a
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
      {product.brand && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {logo && (
            <img
              src={logo.logoUrl}
              alt={product.brand}
              loading="lazy"
              className="h-3.5 w-3.5"
            />
          )}
          {product.brand}
        </div>
      )}
      {product.price && (
        <p className="text-xs text-muted-foreground mt-1">{product.price}</p>
      )}
    </a>
  );
}
