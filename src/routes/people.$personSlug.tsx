import { Link, createFileRoute, notFound } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getPersonBySlug } from '../lib/data';
import type { PersonItem, ScrapedProfileData } from '../lib/types';
import { $getScrapedProfile, $getPersonItems, $trackView } from '../server/functions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/people/$personSlug')({
  loader: ({ params }) => {
    const person = getPersonBySlug(params.personSlug);
    if (!person) {
      throw notFound();
    }
    return { person };
  },
  component: PersonPage,
});

function PersonPage() {
  const { person } = Route.useLoaderData();
  const [scraped, setScraped] = useState<ScrapedProfileData | null>(null);
  const [loadingScrape, setLoadingScrape] = useState(true);
  const [items, setItems] = useState<PersonItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadScrape() {
      try {
        const result = await $getScrapedProfile({ data: person.personSlug });
        if (!cancelled) {
          setScraped(result.data);
        }
      } catch {
        if (!cancelled) {
          setScraped(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingScrape(false);
        }
      }
    }

    async function loadItems() {
      try {
        const result = await $getPersonItems({ data: person.personSlug });
        if (!cancelled) setItems(result);
      } catch {
        /* ignore */
      }
    }

    void loadScrape();
    void loadItems();
    void $trackView({
      data: {
        entityType: 'person',
        entityKey: person.personSlug,
        route: `/people/${person.personSlug}`,
      },
    });

    return () => {
      cancelled = true;
    };
  }, [person.personSlug]);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to directory
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {person.name} {person.emoji}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{person.description}</p>
          <p>
            <a
              href={person.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm underline hover:text-foreground transition-colors"
            >
              Visit their /uses page
            </a>
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {person.canonicalTags.slice(0, 10).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                <Link to="/like/$tag" params={{ tag }}>
                  {tag}
                </Link>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extracted Gear & Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemsList items={items} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Scraped /uses snapshot (Cloudflare D1)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingScrape && (
            <p className="text-sm text-muted-foreground">
              Loading scrape metadata...
            </p>
          )}
          {!loadingScrape && !scraped && (
            <p className="text-sm text-muted-foreground">
              No scrape data is available yet. This page attempts an on-demand
              scrape when loaded.
            </p>
          )}
          {scraped && (
            <div className="space-y-3">
              <p className="text-sm">
                Last fetched:{' '}
                <strong>
                  {new Date(scraped.fetchedAt).toLocaleString()}
                </strong>
                {' · '}Status: {scraped.statusCode ?? 'unknown'}
              </p>
              {scraped.title && (
                <p className="text-sm">
                  Title: <strong>{scraped.title}</strong>
                </p>
              )}
              {scraped.contentMarkdown && (
                <textarea
                  readOnly
                  className="w-full h-[40vh] rounded-md border bg-muted p-3 text-xs font-mono resize-y"
                  defaultValue={scraped.contentMarkdown}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ItemsList({ items }: { items: PersonItem[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge
          key={item.itemSlug}
          variant="outline"
          className="text-xs"
          title={item.detail || undefined}
        >
          <Link to="/items/$itemSlug" params={{ itemSlug: item.itemSlug }}>
            <strong className="hover:underline">{item.item}</strong>
          </Link>
          {item.tags.length > 0 && (
            <span className="ml-1 text-muted-foreground">
              {item.tags.join(', ')}
            </span>
          )}
        </Badge>
      ))}
    </div>
  );
}
