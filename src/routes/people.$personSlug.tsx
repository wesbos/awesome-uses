import { Link, createFileRoute, notFound } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getAllTags, getPersonBySlug } from '../lib/data';
import type { ScrapedProfileData } from '../lib/types';

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
  const tagSlugByName = getAllTags().reduce<Record<string, string>>((acc, tag) => {
    acc[tag.name] = tag.slug;
    return acc;
  }, {});

  useEffect(() => {
    let cancelled = false;
    async function loadScrape() {
      try {
        const response = await fetch(`/api/scrape/${person.personSlug}`);
        if (!response.ok) {
          if (!cancelled) setScraped(null);
          return;
        }
        const payload = (await response.json()) as { data: ScrapedProfileData | null };
        if (!cancelled) {
          setScraped(payload.data);
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
    void loadScrape();

    return () => {
      cancelled = true;
    };
  }, [person.personSlug]);

  return (
    <article className="PersonWrapper">
      <div className="PersonInner">
        <p>
          <Link to="/">← Back to directory</Link>
        </p>
        <h2>
          {person.name} {person.emoji}
        </h2>
        <p>{person.description}</p>

        <p>
          <a href={person.url} target="_blank" rel="noreferrer noopener">
            Visit their /uses page
          </a>
        </p>

        <ul className="Tags">
          {person.canonicalTags.map((tag) => (
            <li className="Tag small" key={tag}>
              <Link to="/tags/$tagSlug" params={{ tagSlug: tagSlugByName[tag] || 'unknown' }}>
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="PersonInner">
        <h3>Scraped /uses snapshot (Cloudflare D1)</h3>
        {loadingScrape && <p>Loading scrape metadata…</p>}
        {!loadingScrape && !scraped && (
          <p>
            No scrape data found yet. Run the scrape CLI to populate the D1
            database.
          </p>
        )}
        {scraped && (
          <div>
            <p>
              Last fetched: <strong>{new Date(scraped.fetchedAt).toLocaleString()}</strong>
            </p>
            {scraped.title && (
              <p>
                Title: <strong>{scraped.title}</strong>
              </p>
            )}
            {scraped.description && <p>{scraped.description}</p>}
            {scraped.excerpt && <p>{scraped.excerpt}</p>}
            <p>
              Status: {scraped.statusCode ?? 'unknown'} · Word count:{' '}
              {scraped.wordCount ?? 'unknown'} · Read time:{' '}
              {scraped.readingMinutes ?? 'unknown'} min
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
