import { Link, createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ItemIcon } from '@/components/ItemIcon';
import { FacePile } from '@/components/FacePile';
import { $getTopProducts, type ProductListItem } from '../server/fn/items';
import { buildMeta, SITE_URL, ogImageUrl } from '../lib/seo';

export const Route = createFileRoute('/products')({
  head: () =>
    buildMeta({
      title: 'Top Products',
      description: 'The most popular products used by developers.',
      ogImage: ogImageUrl({ title: 'Top Products', subtitle: 'What developers use' }),
      canonical: `${SITE_URL}/products`,
    }),
  loader: async () => {
    const products = await $getTopProducts({ data: 'product' }).catch(() => []);
    return { products };
  },
  component: ProductsPage,
} as any);

function ProductsPage() {
  const { products } = Route.useLoaderData() as { products: ProductListItem[] };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to directory
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Top Products</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The 50 most popular physical products used by developers.
        </p>
      </div>

      <div className="grid gap-3">
        {products.map((item, i) => (
          <ProductRow key={item.itemSlug} item={item} rank={i + 1} />
        ))}
      </div>

      {products.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No enriched products available yet.
        </p>
      )}
    </div>
  );
}

function ProductRow({ item, rank }: { item: ProductListItem; rank: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-3">
        <span className="w-6 text-right text-sm font-bold text-muted-foreground tabular-nums">
          {rank}
        </span>
        <ItemIcon itemSlug={item.itemSlug} className="h-6 w-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              to="/items/$itemSlug"
              params={{ itemSlug: item.itemSlug }}
              className="text-sm font-semibold hover:underline truncate"
            >
              {item.itemName}
            </Link>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {item.count} {item.count === 1 ? 'user' : 'users'}
            </span>
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground truncate">{item.description}</p>
          )}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {item.faces.length > 0 && (
          <FacePile faces={item.faces} size="sm" />
        )}
      </CardContent>
    </Card>
  );
}
