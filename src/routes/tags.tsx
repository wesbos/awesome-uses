import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { $getTagSummaries } from '../server/functions';
import type { TagSummary } from '../server/d1';

export const Route = createFileRoute('/tags')({
  component: TagsPage,
});

function TagsPage() {
  const [tags, setTags] = useState<TagSummary[]>([]);
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
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p>Loading tags...</p>;
  if (tags.length === 0) return <p>No extracted items yet. Run the extract pipeline first.</p>;

  const query = search.toLowerCase();
  const filtered = query
    ? tags.filter((t) => t.tag.includes(query))
    : tags;

  return (
    <div className="TagsPage">
      <style>{/*css*/`
        @scope (.TagsPage) {
          :scope { padding: 1rem 0; }
          input {
            padding: 0.4rem 0.75rem;
            border: 1px solid var(--vape, #ccc);
            width: 100%;
            max-width: 400px;
            margin-bottom: 1.5rem;
            background: transparent;
            color: inherit;
            font: inherit;
          }
          & > div {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 1.5rem;
          }
        }
      `}</style>
      <p>
        <Link to="/">← Back to directory</Link>
      </p>
      <h2>Tags ({tags.length})</h2>
      <input
        type="text"
        placeholder="Filter tags..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div>
        {filtered.map((tag) => (
          <TagCard key={tag.tag} tag={tag} />
        ))}
      </div>
    </div>
  );
}

function TagCard({ tag }: { tag: TagSummary }) {
  return (
    <div className="TagCard">
      <style>{/*css*/`
        @scope (.TagCard) {
          :scope {
            border: 1px solid var(--vape, #ddd);
            border-radius: 6px;
            padding: 1rem;
          }
          header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 0.75rem;
          }
          h3 { margin: 0; }
          header span { color: #666; font-size: 0.9rem; }
          ol { margin: 0; padding-left: 1.25rem; }
          li { padding: 0.15rem 0; }
          li span:last-child { color: #888; margin-left: 0.5rem; }
        }
      `}</style>
      <header>
        <h3>{tag.tag}</h3>
        <span>
          {tag.totalItems} unique item{tag.totalItems !== 1 ? 's' : ''}
        </span>
      </header>
      <ol>
        {tag.topItems.map(({ item, count }) => (
          <li key={item}>
            <span>{item}</span>
            <span>({count})</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
