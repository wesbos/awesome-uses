import { Link, createFileRoute, notFound } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getPersonBySlug } from '../lib/data';
import type { PersonItem, ScrapedProfileData } from '../lib/types';
import { $getScrapedProfile, $getPersonItems } from '../server/functions';

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
      } catch { /* ignore */ }
    }

    void loadScrape();
    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [person.personSlug]);

  return (
    <article className="PersonWrapper">
      <style>{/*css*/`
        @scope (.PersonWrapper) {
          :scope {
            border: 1px solid var(--vape);
            border-radius: 5.34334px;
            box-shadow: 10px -10px 0 var(--blue2);
            display: grid;
            grid-template-rows: 1fr auto auto;
          }
          .PersonInner { padding: 2rem; }
          .Tags {
            list-style-type: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-wrap: wrap;
          }
          .Tag {
            background: var(--pink);
            margin: 2px;
            border-radius: 3px;
            font-size: 1.7rem;
            text-decoration: none;
            padding: 5px;
            color: hsla(0, 100%, 100%, 0.8);
            transition: background-color 0.2s;
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            &.small { font-size: 1.2rem; }
            &.currentTag {
              background: var(--yellow);
              color: hsla(0, 100%, 0%, 0.8);
            }
          }
          textarea {
            white-space: pre-wrap;
            max-height: 60vh;
            overflow: auto;
            background: #f5f5f5;
            padding: 1rem;
            border-radius: 4px;
            font-size: 0.85rem;
            width: 100%;
            border: none;
            color: #333;
          }
        }
      `}</style>
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
          {person.canonicalTags.slice(0, 10).map((tag) => (
            <li className="Tag small" key={tag}>
              <Link to="/like/$tag" params={{ tag }}>
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {items.length > 0 && (
        <div className="PersonInner">
          <h3>Extracted Gear & Tools</h3>
          <ItemsList items={items} />
        </div>
      )}

      <div className="PersonInner">
        <h3>Scraped /uses snapshot (Cloudflare D1)</h3>
        {loadingScrape && <p>Loading scrape metadata…</p>}
        {!loadingScrape && !scraped && (
          <p>
            No scrape data is available yet. This page attempts an on-demand
            scrape when loaded.
          </p>
        )}
        {scraped && (
          <div>
            <p>
              Last fetched: <strong>{new Date(scraped.fetchedAt).toLocaleString()}</strong>
              {' · '}Status: {scraped.statusCode ?? 'unknown'}
            </p>
            {scraped.title && (
              <p>
                Title: <strong>{scraped.title}</strong>
              </p>
            )}
            {scraped.contentMarkdown && (
              <textarea readOnly>
                {scraped.contentMarkdown}
              </textarea>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function ItemsList({ items }: { items: PersonItem[] }) {
  return (
    <ul className="ItemsList">
      <style>{/*css*/`
        @scope (.ItemsList) {
          :scope {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
          }
          li {
            border: 1px solid var(--vape, #ddd);
            border-radius: 4px;
            padding: 0.4rem 0.75rem;
          }
          li span { color: #888; margin-left: 0.4rem; }
        }
      `}</style>
      {items.map((item) => (
        <li key={item.item} title={item.detail || undefined}>
          <strong>{item.item}</strong>
          {item.tags.length > 0 && (
            <span>{item.tags.join(', ')}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
