import { Link, createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  $getScrapeStatus,
  $getScrapedProfile,
  type DashboardRow,
  type DashboardPayload,
} from '../server/functions';

type FilterMode = 'all' | 'scraped' | 'pending' | 'errors';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

function StatusBadge({ row }: { row: DashboardRow }) {
  if (!row.scraped) {
    return <span className="status-pending">pending</span>;
  }
  if (row.statusCode && row.statusCode >= 200 && row.statusCode < 400) {
    return <span className="status-ok">{row.statusCode}</span>;
  }
  return <span className="status-error">{row.statusCode ?? 'error'}</span>;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const CONCURRENCY = 5;

function useScrapeAll(
  rows: DashboardRow[],
  onRowUpdate: (slug: string, patch: Partial<DashboardRow>) => void
) {
  const [scraping, setScraping] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const cancelledRef = useRef(false);

  const start = useCallback(
    (targetRows: DashboardRow[]) => {
      if (scraping) return;
      cancelledRef.current = false;
      setScraping(true);
      setCompleted(0);
      setTotal(targetRows.length);

      let nextIndex = 0;

      async function worker() {
        while (!cancelledRef.current) {
          const idx = nextIndex++;
          if (idx >= targetRows.length) break;
          const row = targetRows[idx];
          try {
            const result = await $getScrapedProfile({ data: row.personSlug });
            if (result.data) {
              onRowUpdate(row.personSlug, {
                scraped: true,
                statusCode: result.data.statusCode,
                fetchedAt: result.data.fetchedAt,
                title: result.data.title,
              });
            } else {
              onRowUpdate(row.personSlug, { scraped: true, statusCode: null, fetchedAt: new Date().toISOString() });
            }
          } catch {
            onRowUpdate(row.personSlug, { scraped: true, statusCode: null, fetchedAt: new Date().toISOString() });
          }
          setCompleted((c) => c + 1);
        }
      }

      void Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, targetRows.length) }, () => worker())
      ).then(() => {
        setScraping(false);
      });
    },
    [scraping, onRowUpdate]
  );

  const stop = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return { scraping, completed, total, start, stop };
}

function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');

  const handleRowUpdate = useCallback((slug: string, patch: Partial<DashboardRow>) => {
    setData((prev) => {
      if (!prev) return prev;
      const wasScrapedBefore = prev.rows.find((r) => r.personSlug === slug)?.scraped;
      const rows = prev.rows.map((r) => (r.personSlug === slug ? { ...r, ...patch } : r));
      const scrapedDelta = patch.scraped && !wasScrapedBefore ? 1 : 0;
      return { ...prev, rows, scraped: prev.scraped + scrapedDelta };
    });
  }, []);

  const { scraping, completed, total, start, stop } = useScrapeAll(
    data?.rows ?? [],
    handleRowUpdate
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const payload = await $getScrapeStatus();
        if (!cancelled) setData(payload);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p>Loading dashboard...</p>;
  if (!data) return <p>Failed to load scrape status.</p>;

  const errorCount = data.rows.filter(
    (r) => r.scraped && (!r.statusCode || r.statusCode >= 400)
  ).length;
  const pendingCount = data.total - data.scraped;

  const query = search.toLowerCase();
  const filtered = data.rows.filter((row) => {
    if (filter === 'scraped' && !row.scraped) return false;
    if (filter === 'pending' && row.scraped) return false;
    if (filter === 'errors') {
      if (!row.scraped) return false;
      if (row.statusCode && row.statusCode < 400) return false;
    }
    if (query && !row.name.toLowerCase().includes(query) && !row.url.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });

  return (
    <div className="Dashboard">
      <style>{/*css*/`
        @scope (.Dashboard) {
          :scope { padding: 1rem 0; }

          .stats { display: flex; gap: 2rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
          .stats div div:first-child { font-size: 2rem; font-weight: bold; }
          .stats div div:last-child { color: #666; }
          .green { color: #22863a; }
          .muted { color: #888; }
          .red { color: #cb2431; }

          .actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.5rem; }
          button {
            padding: 0.5rem 1.25rem;
            border: 1px solid var(--vape, #ccc);
            border-radius: 4px;
            background: transparent;
            cursor: pointer;
            color: inherit;
            font: inherit;
          }
          button.danger { background: #cb2431; color: #fff; border: none; font-weight: bold; }
          button.primary { background: var(--blue2, #0070f3); color: #fff; border: none; font-weight: bold; }
          button.primary:disabled { background: #ccc; cursor: default; }
          progress { flex: 1 1 150px; height: 8px; }

          .filters { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
          .filters button { padding: 0.35rem 0.75rem; text-transform: capitalize; }
          .filters button.active { background: var(--blue2, #0070f3); color: #fff; }
          .filters input {
            padding: 0.35rem 0.75rem;
            border: 1px solid var(--vape, #ccc);
            border-radius: 4px;
            flex: 1 1 200px;
            min-width: 200px;
            background: transparent;
            color: inherit;
            font: inherit;
          }

          table { width: 100%; border-collapse: collapse; }
          thead tr { border-bottom: 2px solid var(--vape, #ccc); text-align: left; }
          th { padding: 0.5rem; }
          tbody tr { border-bottom: 1px solid var(--vape, #eee); }
          td { padding: 0.4rem 0.5rem; }
          td.truncate { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          td.url { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          td.nowrap { white-space: nowrap; }

          .status-pending { color: #888; }
          .status-ok { color: #22863a; }
          .status-error { color: #cb2431; }
        }
      `}</style>
      <p>
        <Link to="/">← Back to directory</Link>
      </p>
      <h2>Scrape Dashboard</h2>

      <div className="stats">
        <Stat label="Total" value={data.total} />
        <Stat label="Scraped" value={data.scraped} colorClass="green" />
        <Stat label="Pending" value={pendingCount} colorClass="muted" />
        <Stat label="Errors" value={errorCount} colorClass="red" />
      </div>

      <div className="actions">
        {scraping ? (
          <>
            <button className="danger" onClick={stop}>Stop</button>
            <span>Scraping... {completed} / {total}</span>
            <progress value={completed} max={total} />
          </>
        ) : (
          <>
            <button
              className="primary"
              onClick={() => start(data.rows.filter((r) => !r.scraped))}
              disabled={pendingCount === 0}
            >
              Scrape Pending ({pendingCount})
            </button>
            <button onClick={() => start(data.rows)}>
              Re-scrape All ({data.total})
            </button>
          </>
        )}
      </div>

      <div className="filters">
        {(['all', 'scraped', 'pending', 'errors'] as const).map((mode) => (
          <button
            key={mode}
            className={filter === mode ? 'active' : ''}
            onClick={() => setFilter(mode)}
          >
            {mode}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search by name or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <p>
        Showing {filtered.length} of {data.total}
      </p>

      <div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Title</th>
              <th>Fetched</th>
              <th>URL</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.personSlug}>
                <td>
                  <Link to="/people/$personSlug" params={{ personSlug: row.personSlug }}>
                    {row.name}
                  </Link>
                </td>
                <td><StatusBadge row={row} /></td>
                <td className="truncate">{row.title ?? '—'}</td>
                <td className="nowrap">{row.fetchedAt ? timeAgo(row.fetchedAt) : '—'}</td>
                <td className="url">
                  <a href={row.url} target="_blank" rel="noreferrer noopener">{row.url}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, colorClass }: { label: string; value: number; colorClass?: string }) {
  return (
    <div>
      <div className={colorClass}>{value.toLocaleString()}</div>
      <div>{label}</div>
    </div>
  );
}
