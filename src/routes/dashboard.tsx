import { Link, createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  $applyTagReclassify,
  $getAdminDashboardData,
  $getScrapeStatus,
  $mergeItems,
  $previewTagReclassify,
  $searchItems,
  $reScrapeAndExtract,
  type AdminDashboardData,
  $getScrapedProfile,
  type DashboardRow,
  type DashboardPayload,
  type ReclassifyPreviewPayload,
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

// ---------------------------------------------------------------------------
// DashboardPage — thin orchestrator, loads data and renders child components
// ---------------------------------------------------------------------------

function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const payload = await $getScrapeStatus();
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setData(null);
      }
      try {
        const adminPayload = await $getAdminDashboardData();
        if (!cancelled) setAdminData(adminPayload);
      } catch {
        if (!cancelled) setAdminData(null);
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

  async function refreshAdminData() {
    try {
      const payload = await $getAdminDashboardData();
      setAdminData(payload);
    } catch {
      setAdminData(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to directory
        </Link>
      </div>

      <h2 className="text-xl font-semibold">Scrape Dashboard</h2>

      <ScrapeTable initialData={data} />

      {adminData && (
        <>
          <h3 className="text-lg font-semibold pt-6">Admin Controls</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <ScrapeStatsCard stats={adminData.scrapeStats} />
            <AnalyticsCard analytics={adminData.analytics} />
          </div>

          <ReclassifyCard categories={adminData.categories} onApplied={refreshAdminData} />
          <MergeItemsCard onMerged={refreshAdminData} />
          <RecentEventsCard events={adminData.recentScrapeEvents} />
          <PersonHistoryCard history={adminData.personScrapeHistory} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScrapeTable — people table with filters, search, selection, scrape controls
// ---------------------------------------------------------------------------

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

function ScrapeTable({ initialData }: { initialData: DashboardPayload }) {
  const [data, setData] = useState(initialData);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scrapeSelectedBusy, setScrapeSelectedBusy] = useState(false);
  const [scrapeSelectedProgress, setScrapeSelectedProgress] = useState({ done: 0, total: 0 });

  function toggleSelected(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
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

    for (let i = 0; i < slugs.length; i++) {
      try {
        await $reScrapeAndExtract({ data: { personSlug: slugs[i] } });
      } catch {
        // continue with next
      }
      setScrapeSelectedProgress({ done: i + 1, total: slugs.length });
    }

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
    <>
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
              <TableHead>Title</TableHead>
              <TableHead>Fetched</TableHead>
              <TableHead>URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.personSlug}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(row.personSlug)}
                    onChange={() => toggleSelected(row.personSlug)}
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
    </>
  );
}

// ---------------------------------------------------------------------------
// ReclassifyCard — AI-powered tag reclassification
// ---------------------------------------------------------------------------

function ReclassifyCard({ categories, onApplied }: { categories: string[]; onApplied: () => Promise<void> }) {
  const [category, setCategory] = useState(() =>
    categories.length > 0 ? categories[0] : 'other'
  );
  const [minUsers, setMinUsers] = useState(2);
  const [limit, setLimit] = useState(80);
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState<ReclassifyPreviewPayload | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function runPreview() {
    setMessage(null);
    setPreviewing(true);
    setPreview(null);
    try {
      const result = await $previewTagReclassify({
        data: {
          category,
          minUsers,
          limit,
          prompt: prompt || undefined,
        },
      });
      setPreview(result);
    } catch (error) {
      console.error('Reclassify preview failed:', error);
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Failed to preview reclassification.' });
    } finally {
      setPreviewing(false);
    }
  }

  async function apply() {
    if (!preview) return;
    const assignments = preview.output.items.map((item) => ({
      item: item.item,
      categories: item.categories,
    }));
    setApplying(true);
    setMessage(null);
    try {
      const result = await $applyTagReclassify({
        data: { category: preview.category, assignments },
      });
      await onApplied();
      setMessage({
        ok: true,
        text: `Applied reclassification: ${result.updatedRows} rows across ${result.updatedItems} items.`,
      });
    } catch (error) {
      console.error('Reclassify apply failed:', error);
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Failed to apply reclassification.' });
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h4 className="font-medium">Reclassify tags with prompt</h4>
        <div className="grid gap-2 md:grid-cols-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <Input
            type="number"
            min={1}
            value={minUsers}
            onChange={(e) => setMinUsers(Number(e.target.value) || 1)}
            placeholder="Min users"
          />
          <Input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 1)}
            placeholder="Item limit"
          />
          <Button onClick={runPreview} disabled={previewing}>
            {previewing ? 'Previewing...' : 'Preview'}
          </Button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Optional custom prompt"
          className="w-full min-h-[90px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />

        {message && (
          <p className={`text-xs ${message.ok ? 'text-muted-foreground' : 'text-destructive font-medium'}`}>{message.text}</p>
        )}

        {preview && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Candidate items: {preview.totalCandidates}
            </p>
            <div className="max-h-72 overflow-auto rounded-md border p-2 text-sm space-y-1">
              {preview.output.items.map((entry) => (
                <div key={entry.item} className="flex items-start justify-between gap-3">
                  <span>{entry.item}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.categories.join(', ')}
                  </span>
                </div>
              ))}
            </div>
            <Button onClick={apply} disabled={applying}>
              {applying ? 'Applying...' : 'Apply reclassification'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// MergeItemsCard — merge duplicate items into one canonical item
// ---------------------------------------------------------------------------

function MergeItemsCard({ onMerged }: { onMerged: () => Promise<void> }) {
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemSearchResults, setItemSearchResults] = useState<
    Array<{ item: string; itemSlug: string; count: number }>
  >([]);
  const [searchingItems, setSearchingItems] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [canonicalItem, setCanonicalItem] = useState('');
  const [sourceItems, setSourceItems] = useState<string[]>([]);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeResult, setMergeResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function runItemSearch() {
    setSearchingItems(true);
    setSearchError(null);
    setItemSearchResults([]);
    try {
      const results = await $searchItems({ data: itemSearchQuery });
      if (!Array.isArray(results)) {
        throw new Error(`Unexpected response from server: ${JSON.stringify(results)}`);
      }
      setItemSearchResults(results);
      if (results.length === 0 && itemSearchQuery.trim()) {
        setSearchError(`No items found matching "${itemSearchQuery}"`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed — unknown error';
      console.error('Item search failed:', error);
      setSearchError(message);
    } finally {
      setSearchingItems(false);
    }
  }

  async function applyMerge() {
    if (!canonicalItem || sourceItems.length === 0) return;
    setMergeBusy(true);
    setMergeResult(null);
    try {
      const result = await $mergeItems({
        data: { canonicalItem, sourceItems },
      });
      setMergeResult({
        ok: true,
        message: `Merged ${result.mergedItems.length} items into "${result.canonicalItem}" (${result.upsertedRows} row updates, ${result.deletedRows} source rows removed).`,
      });
      await Promise.all([onMerged(), runItemSearch()]);
      setSourceItems([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to merge items.';
      console.error('Merge failed:', error);
      setMergeResult({ ok: false, message });
    } finally {
      setMergeBusy(false);
    }
  }

  function toggleSourceItem(item: string) {
    setSourceItems((prev) =>
      prev.includes(item) ? prev.filter((entry) => entry !== item) : [...prev, item]
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h4 className="font-medium">Merge items into one</h4>
        <div className="flex gap-2">
          <Input
            value={itemSearchQuery}
            onChange={(e) => setItemSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runItemSearch()}
            placeholder="Search items..."
          />
          <Button onClick={runItemSearch} disabled={searchingItems || !itemSearchQuery.trim()}>
            {searchingItems ? 'Searching...' : 'Search'}
          </Button>
        </div>
        {searchError && (
          <p className="text-xs text-destructive">{searchError}</p>
        )}
        <Input
          value={canonicalItem}
          onChange={(e) => setCanonicalItem(e.target.value)}
          placeholder="Canonical item"
        />
        {itemSearchResults.length > 0 && (
          <div className="max-h-56 overflow-auto rounded-md border p-2 space-y-1">
            {itemSearchResults.map((entry) => (
              <label key={entry.itemSlug} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{entry.item} <span className="text-muted-foreground">({entry.count})</span></span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => setCanonicalItem(entry.item)}
                  >
                    set main
                  </button>
                  <input
                    type="checkbox"
                    checked={sourceItems.includes(entry.item)}
                    onChange={() => toggleSourceItem(entry.item)}
                    disabled={canonicalItem === entry.item}
                  />
                </div>
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Merge sources: {sourceItems.join(', ') || 'none selected'}
        </p>
        <Button
          onClick={applyMerge}
          disabled={mergeBusy || !canonicalItem || sourceItems.length === 0}
        >
          {mergeBusy ? 'Merging...' : 'Merge selected items'}
        </Button>
        {mergeResult && (
          <p className={`text-xs ${mergeResult.ok ? 'text-muted-foreground' : 'text-destructive font-medium'}`}>
            {mergeResult.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Small presentational cards
// ---------------------------------------------------------------------------

function ScrapeStatsCard({ stats }: { stats: AdminDashboardData['scrapeStats'] }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h4 className="font-medium">Scrape & Update History</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Total events: <strong>{stats.totalEvents}</strong></div>
          <div>Updated: <strong>{stats.updatedEvents}</strong></div>
          <div>Initial: <strong>{stats.initialEvents}</strong></div>
          <div>Errors: <strong>{stats.errorEvents}</strong></div>
        </div>
        <p className="text-xs text-muted-foreground">
          Last event: {stats.lastEventAt ? timeAgo(stats.lastEventAt) : '—'}
        </p>
      </CardContent>
    </Card>
  );
}

function AnalyticsCard({ analytics }: { analytics: AdminDashboardData['analytics'] }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h4 className="font-medium">View Analytics (30d)</h4>
        {!analytics.available && (
          <p className="text-xs text-muted-foreground">{analytics.reason}</p>
        )}
        {analytics.available && (
          <div className="grid grid-cols-3 gap-3 text-xs">
            <TopList title="People" items={analytics.people} />
            <TopList title="Tags" items={analytics.tags} />
            <TopList title="Items" items={analytics.items} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentEventsCard({ events }: { events: AdminDashboardData['recentScrapeEvents'] }) {
  const updated = events.filter((e) => e.changeType === 'updated').slice(0, 40);
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h4 className="font-medium">Recent update events</h4>
        <div className="max-h-64 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {updated.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.personSlug}</TableCell>
                  <TableCell>{event.changeType}</TableCell>
                  <TableCell>{event.statusCode ?? '—'}</TableCell>
                  <TableCell>{timeAgo(event.fetchedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PersonHistoryCard({ history }: { history: AdminDashboardData['personScrapeHistory'] }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h4 className="font-medium">Per-person scrape/update history</h4>
        <div className="max-h-72 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Scrapes</TableHead>
                <TableHead>Updates</TableHead>
                <TableHead>Last scraped</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.slice(0, 120).map((row) => (
                <TableRow key={row.personSlug}>
                  <TableCell>{row.personSlug}</TableCell>
                  <TableCell>{row.scrapeCount}</TableCell>
                  <TableCell>{row.updateCount}</TableCell>
                  <TableCell>{row.lastScrapedAt ? timeAgo(row.lastScrapedAt) : '—'}</TableCell>
                  <TableCell>{row.lastUpdatedAt ? timeAgo(row.lastUpdatedAt) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
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

function TopList({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; views: number }>;
}) {
  return (
    <div>
      <h5 className="font-medium mb-1">{title}</h5>
      <ul className="space-y-0.5">
        {items.slice(0, 5).map((entry) => (
          <li key={entry.key} className="flex items-center justify-between gap-2">
            <span className="truncate">{entry.key}</span>
            <span className="text-muted-foreground">{entry.views}</span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-muted-foreground">No data</li>
        )}
      </ul>
    </div>
  );
}
