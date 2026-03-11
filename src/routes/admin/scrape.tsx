import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import type { DashboardRow, DashboardPayload } from '../../server/fn/profiles';
import {
  apiGetScrapeStatus,
  apiRescrapeAndExtract,
  apiScrapePerson,
  apiGetGitHubStatus,
  apiFetchGitHubProfile,
  apiFetchGitHubBatch,
  type GitHubStatusRow,
} from '../../lib/site-management-api';
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
import { useShiftSelect } from '@/hooks/useShiftSelect';
import { Github } from 'lucide-react';

type FilterMode = 'all' | 'scraped' | 'pending' | 'errors' | 'vectorized' | 'not-vectorized' | 'gh-fresh' | 'gh-expired' | 'gh-pending';

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
            const result = await apiScrapePerson(row.personSlug);
            onRowUpdate(row.personSlug, {
              scraped: true,
              statusCode: result.statusCode,
              fetchedAt: result.fetchedAt,
              title: result.title,
            });
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

function Stat({ label, value, className }: { label: React.ReactNode; value: number; className?: string }) {
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
  const { data, isLoading } = useQuery<DashboardPayload>({
    queryKey: ['site-tools', 'pipeline.getScrapeStatus'],
    queryFn: apiGetScrapeStatus,
    retry: false,
    enabled: typeof window !== 'undefined',
  });

  const { data: ghData } = useQuery({
    queryKey: ['site-tools', 'pipeline.getGitHubStatus'],
    queryFn: apiGetGitHubStatus,
    retry: false,
    enabled: typeof window !== 'undefined',
  });

  if (isLoading) return <p className="text-muted-foreground">Loading scrape data...</p>;
  if (!data) return <p className="text-muted-foreground">Failed to load scrape status.</p>;

  const ghMap = new Map<string, GitHubStatusRow>();
  if (ghData) {
    for (const row of ghData.rows) {
      ghMap.set(row.personSlug, row);
    }
  }

  return <ScrapeTable initialData={data} ghMap={ghMap} ghSummary={ghData ?? null} />;
}

type GitHubSummary = { total: number; fetched: number; fresh: number; expired: number };

function ScrapeTable({ initialData, ghMap, ghSummary }: { initialData: DashboardPayload; ghMap: Map<string, GitHubStatusRow>; ghSummary: GitHubSummary | null }) {
  const queryClient = useQueryClient();
  const [data, setData] = useState(initialData);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const { selected, handleRowClick, toggleAll, allSelected, clearSelection } = useShiftSelect<DashboardRow>((r) => r.personSlug);
  const [scrapeSelectedBusy, setScrapeSelectedBusy] = useState(false);
  const [scrapeSelectedProgress, setScrapeSelectedProgress] = useState({ done: 0, total: 0 });
  const [ghFetchingSlug, setGhFetchingSlug] = useState<string | null>(null);

  const ghBatchMutation = useMutation({
    mutationFn: (input: { limit?: number; concurrency?: number; pendingOnly?: boolean }) =>
      apiFetchGitHubBatch(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-tools', 'pipeline.getGitHubStatus'] });
    },
  });

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
          await apiRescrapeAndExtract(slugs[idx]);
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
    clearSelection();
    try {
      const payload = await apiGetScrapeStatus();
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
    if (filter === 'gh-fresh' || filter === 'gh-expired' || filter === 'gh-pending') {
      const gh = ghMap.get(row.personSlug);
      if (filter === 'gh-fresh' && !(gh?.fetched && !gh.expired)) return false;
      if (filter === 'gh-expired' && !(gh?.fetched && gh.expired)) return false;
      if (filter === 'gh-pending' && (gh?.fetched || !ghMap.has(row.personSlug))) {
        // gh-pending: has github username but not fetched
        if (!ghMap.has(row.personSlug)) return false;
        if (gh?.fetched) return false;
      }
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
        <Stat label="Total" value={data.total} />
        <Stat label="Scraped" value={data.scraped} className="text-green-500" />
        <Stat label="Vectorized" value={data.vectorized} className="text-blue-500" />
        <Stat label="Pending" value={pendingCount} className="text-muted-foreground" />
        <Stat label="Errors" value={errorCount} className="text-destructive" />
        {ghSummary && (
          <>
            <Stat label={<span className="inline-flex items-center gap-1"><Github className="h-3 w-3" /> Fresh</span>} value={ghSummary.fresh} className="text-green-500" />
            <Stat label={<span className="inline-flex items-center gap-1"><Github className="h-3 w-3" /> Expired</span>} value={ghSummary.expired} className="text-yellow-500" />
            <Stat label={<span className="inline-flex items-center gap-1"><Github className="h-3 w-3" /> Pending</span>} value={ghSummary.total - ghSummary.fetched} className="text-muted-foreground" />
          </>
        )}
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
              <>
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
                {ghSummary && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={ghBatchMutation.isPending}
                    onClick={() => ghBatchMutation.mutate({ personSlugs: [...selected], concurrency: 3, pendingOnly: false })}
                    className="inline-flex items-center gap-1"
                  >
                    <Github className="h-3.5 w-3.5" />
                    {ghBatchMutation.isPending ? 'Fetching...' : `Fetch Selected (${selected.size})`}
                  </Button>
                )}
              </>
            )}
            {ghSummary && !selected.size && (
              <Button
                size="sm"
                variant="outline"
                disabled={ghBatchMutation.isPending || (ghSummary.total - ghSummary.fetched) === 0}
                onClick={() => ghBatchMutation.mutate({ limit: 500, concurrency: 3, pendingOnly: true })}
                className="inline-flex items-center gap-1"
              >
                <Github className="h-3.5 w-3.5" />
                {ghBatchMutation.isPending ? 'Fetching...' : `Fetch Pending (${ghSummary.total - ghSummary.fetched})`}
              </Button>
            )}
            {ghBatchMutation.data && (
              <span className="text-sm text-muted-foreground">
                <Github className="h-3 w-3 inline" /> {ghBatchMutation.data.successes} fetched, {ghBatchMutation.data.failures} failed
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'scraped', 'pending', 'errors', 'vectorized', 'not-vectorized', 'gh-fresh', 'gh-expired', 'gh-pending'] as const).map((mode) => {
          const ghIcon = mode.startsWith('gh-');
          const labels: Record<string, string> = {
            'not-vectorized': 'Not Vectorized',
            'gh-fresh': 'Fresh',
            'gh-expired': 'Expired',
            'gh-pending': 'Pending',
          };
          return (
            <Button
              key={mode}
              variant={filter === mode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(mode)}
              className="capitalize inline-flex items-center gap-1"
            >
              {ghIcon && <Github className="h-3 w-3" />}
              {labels[mode] ?? mode}
            </Button>
          );
        })}
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
                  checked={allSelected(filtered)}
                  onChange={() => toggleAll(filtered)}
                  className="accent-primary"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vector</TableHead>
              <TableHead><Github className="h-3.5 w-3.5 inline" /></TableHead>
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
                    onChange={() => handleRowClick(idx, row, filtered)}
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
                <TableCell>
                  <GitHubCell
                    row={row}
                    gh={ghMap.get(row.personSlug) ?? null}
                    isFetching={ghFetchingSlug === row.personSlug}
                    onFetch={async (force) => {
                      setGhFetchingSlug(row.personSlug);
                      try {
                        await apiFetchGitHubProfile(row.personSlug, force);
                        queryClient.invalidateQueries({ queryKey: ['site-tools', 'pipeline.getGitHubStatus'] });
                      } catch { /* ignore */ }
                      setGhFetchingSlug(null);
                    }}
                  />
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

function GitHubCell({
  row,
  gh,
  isFetching,
  onFetch,
}: {
  row: DashboardRow;
  gh: GitHubStatusRow | null;
  isFetching: boolean;
  onFetch: (force: boolean) => void;
}) {
  if (!gh) {
    // Person has no github username
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  if (isFetching) {
    return <span className="text-xs text-muted-foreground">...</span>;
  }

  if (!gh.fetched) {
    return (
      <button
        onClick={() => onFetch(false)}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        fetch
      </button>
    );
  }

  if (gh.expired) {
    return (
      <button
        onClick={() => onFetch(true)}
        className="text-xs"
      >
        <Badge variant="outline" className="text-yellow-600 border-yellow-600/30 cursor-pointer">expired</Badge>
      </button>
    );
  }

  return (
    <button
      onClick={() => onFetch(true)}
      className="text-xs"
      title={gh.fetchedAt ? `Fetched ${timeAgo(gh.fetchedAt)}` : undefined}
    >
      <Badge variant="outline" className="text-green-500 border-green-500/30 cursor-pointer">
        {gh.fetchedAt ? timeAgo(gh.fetchedAt) : 'yes'}
      </Badge>
    </button>
  );
}
