import { Link, createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { $getScrapedProfile, $getScrapeStatus, $reScrapeAndExtract, type DashboardRow, type DashboardPayload } from '../../server/fn/profiles';
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

type FilterMode = 'all' | 'scraped' | 'pending' | 'errors' | 'vectorized' | 'not-vectorized';

export const Route = createFileRoute('/admin/scrape')({
  component: ScrapePage,
});

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

function StatusBadge({ row }: { row: DashboardRow }) {
  if (!row.scraped) {
    return <Badge variant="secondary">pending</Badge>;
  }
  if (row.statusCode && row.statusCode >= 200 && row.statusCode < 400) {
    return <Badge variant="outline" className="text-green-500 border-green-500/30">{row.statusCode}</Badge>;
  }
  return <Badge variant="destructive">{row.statusCode ?? 'error'}</Badge>;
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
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

function ScrapePage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const payload = await $getScrapeStatus();
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading scrape data...</p>;
  if (!data) return <p className="text-muted-foreground">Failed to load scrape status.</p>;

  return <ScrapeTable initialData={data} />;
}

function ScrapeTable({ initialData }: { initialData: DashboardPayload }) {
  const [data, setData] = useState(initialData);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scrapeSelectedBusy, setScrapeSelectedBusy] = useState(false);
  const [scrapeSelectedProgress, setScrapeSelectedProgress] = useState({ done: 0, total: 0 });
  const lastClickedIndex = useRef<number | null>(null);
  const shiftHeld = useRef(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeld.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeld.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  function handleRowClick(index: number, slug: string, filteredRows: DashboardRow[]) {
    if (shiftHeld.current && lastClickedIndex.current !== null) {
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(filteredRows[i].personSlug);
        }
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) next.delete(slug);
        else next.add(slug);
        return next;
      });
    }
    lastClickedIndex.current = index;
  }

  function toggleAllFiltered(filteredRows: DashboardRow[]) {
    setSelected((prev) => {
      const allSelected = filteredRows.every((r) => prev.has(r.personSlug));
      if (allSelected) {
        const next = new Set(prev);
        for (const r of filteredRows) next.delete(r.personSlug);
        return next;
      }
      const next = new Set(prev);
      for (const r of filteredRows) next.add(r.personSlug);
      return next;
    });
  }

  async function scrapeSelected() {
    const slugs = [...selected];
    if (slugs.length === 0) return;
    setScrapeSelectedBusy(true);
    setScrapeSelectedProgress({ done: 0, total: slugs.length });

    let nextIndex = 0;
    let done = 0;
    const concurrency = 10;

    async function worker() {
      while (nextIndex < slugs.length) {
        const idx = nextIndex++;
        try {
          await $reScrapeAndExtract({ data: { personSlug: slugs[idx] } });
        } catch {
          // continue with next
        }
        done++;
        setScrapeSelectedProgress({ done, total: slugs.length });
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, slugs.length) }, () => worker()),
    );

    setScrapeSelectedBusy(false);
    setSelected(new Set());
    try {
      const payload = await $getScrapeStatus();
      setData(payload);
    } catch { /* ignore */ }
  }

  const handleRowUpdate = useCallback(
    (slug: string, patch: Partial<DashboardRow>) => {
      setData((prev) => {
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
    data.rows,
    handleRowUpdate,
  );

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
    if (filter === 'vectorized' && !row.vectorized) return false;
    if (filter === 'not-vectorized' && row.vectorized) return false;
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Stat label="Total" value={data.total} />
        <Stat label="Scraped" value={data.scraped} className="text-green-500" />
        <Stat label="Vectorized" value={data.vectorized} className="text-blue-500" />
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
            {selected.size > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={scrapeSelected}
                disabled={scrapeSelectedBusy}
              >
                {scrapeSelectedBusy
                  ? `Scraping... ${scrapeSelectedProgress.done}/${scrapeSelectedProgress.total}`
                  : `Scrape Selected (${selected.size})`}
              </Button>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'scraped', 'pending', 'errors', 'vectorized', 'not-vectorized'] as const).map((mode) => (
          <Button
            key={mode}
            variant={filter === mode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(mode)}
            className="capitalize"
          >
            {mode === 'not-vectorized' ? 'Not Vectorized' : mode}
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

      <div className="max-h-[80vh] overflow-y-auto rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((r) => selected.has(r.personSlug))}
                  onChange={() => toggleAllFiltered(filtered)}
                  className="accent-primary"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vector</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Fetched</TableHead>
              <TableHead>URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row, idx) => (
              <TableRow key={row.personSlug}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(row.personSlug)}
                    onChange={() => handleRowClick(idx, row.personSlug, filtered)}
                    className="accent-primary"
                  />
                </TableCell>
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
                <TableCell>
                  {row.vectorized
                    ? <Badge variant="outline" className="text-blue-500 border-blue-500/30">yes</Badge>
                    : <span className="text-muted-foreground text-xs">—</span>}
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
    </div>
  );
}
