import { Link, createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  $getScrapeStatus,
  $getScrapedProfile,
  type DashboardRow,
  type DashboardPayload,
} from '../server/functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type FilterMode = 'all' | 'scraped' | 'pending' | 'errors';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

function StatusBadge({ row }: { row: DashboardRow }) {
  if (!row.scraped) {
    return <Badge variant="secondary">pending</Badge>;
  }
  if (row.statusCode && row.statusCode >= 200 && row.statusCode < 400) {
    return <Badge variant="outline" className="text-green-500 border-green-500/30">{row.statusCode}</Badge>;
  }
  return <Badge variant="destructive">{row.statusCode ?? 'error'}</Badge>;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
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
  onRowUpdate: (slug: string, patch: Partial<DashboardRow>) => void,
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
            const result = await $getScrapedProfile({
              data: row.personSlug,
            });
            if (result.data) {
              onRowUpdate(row.personSlug, {
                scraped: true,
                statusCode: result.data.statusCode,
                fetchedAt: result.data.fetchedAt,
                title: result.data.title,
              });
            } else {
              onRowUpdate(row.personSlug, {
                scraped: true,
                statusCode: null,
                fetchedAt: new Date().toISOString(),
              });
            }
          } catch {
            onRowUpdate(row.personSlug, {
              scraped: true,
              statusCode: null,
              fetchedAt: new Date().toISOString(),
            });
          }
          setCompleted((c) => c + 1);
        }
      }

      void Promise.all(
        Array.from(
          { length: Math.min(CONCURRENCY, targetRows.length) },
          () => worker(),
        ),
      ).then(() => {
        setScraping(false);
      });
    },
    [scraping, onRowUpdate],
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

  const handleRowUpdate = useCallback(
    (slug: string, patch: Partial<DashboardRow>) => {
      setData((prev) => {
        if (!prev) return prev;
        const wasScrapedBefore = prev.rows.find(
          (r) => r.personSlug === slug,
        )?.scraped;
        const rows = prev.rows.map((r) =>
          r.personSlug === slug ? { ...r, ...patch } : r,
        );
        const scrapedDelta = patch.scraped && !wasScrapedBefore ? 1 : 0;
        return { ...prev, rows, scraped: prev.scraped + scrapedDelta };
      });
    },
    [],
  );

  const { scraping, completed, total, start, stop } = useScrapeAll(
    data?.rows ?? [],
    handleRowUpdate,
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
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading)
    return <p className="text-muted-foreground">Loading dashboard...</p>;
  if (!data)
    return <p className="text-muted-foreground">Failed to load scrape status.</p>;

  const errorCount = data.rows.filter(
    (r) => r.scraped && (!r.statusCode || r.statusCode >= 400),
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
    if (
      query &&
      !row.name.toLowerCase().includes(query) &&
      !row.url.toLowerCase().includes(query)
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to directory
        </Link>
      </div>

      <h2 className="text-xl font-semibold">Scrape Dashboard</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Total" value={data.total} />
        <Stat label="Scraped" value={data.scraped} className="text-green-500" />
        <Stat label="Pending" value={pendingCount} className="text-muted-foreground" />
        <Stat label="Errors" value={errorCount} className="text-destructive" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {scraping ? (
          <>
            <Button variant="destructive" size="sm" onClick={stop}>
              Stop
            </Button>
            <span className="text-sm text-muted-foreground">
              Scraping... {completed} / {total}
            </span>
            <progress
              value={completed}
              max={total}
              className="flex-1 h-2 min-w-[100px]"
            />
          </>
        ) : (
          <>
            <Button
              size="sm"
              onClick={() => start(data.rows.filter((r) => !r.scraped))}
              disabled={pendingCount === 0}
            >
              Scrape Pending ({pendingCount})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => start(data.rows)}
            >
              Re-scrape All ({data.total})
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'scraped', 'pending', 'errors'] as const).map((mode) => (
          <Button
            key={mode}
            variant={filter === mode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(mode)}
            className="capitalize"
          >
            {mode}
          </Button>
        ))}
        <Input
          type="text"
          placeholder="Search by name or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px]"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {data.total}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Fetched</TableHead>
            <TableHead>URL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row) => (
            <TableRow key={row.personSlug}>
              <TableCell>
                <Link
                  to="/people/$personSlug"
                  params={{ personSlug: row.personSlug }}
                  className="hover:underline"
                >
                  {row.name}
                </Link>
              </TableCell>
              <TableCell>
                <StatusBadge row={row} />
              </TableCell>
              <TableCell className="max-w-[250px] truncate">
                {row.title ?? '—'}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {row.fetchedAt ? timeAgo(row.fetchedAt) : '—'}
              </TableCell>
              <TableCell className="max-w-[300px] truncate">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:underline"
                >
                  {row.url}
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-bold ${className ?? ''}`}>
          {value.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
