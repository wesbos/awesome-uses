import { Link, createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  $applyTagReclassify,
  $getAdminDashboardData,
  $getScrapeStatus,
  $mergeItems,
  $previewTagReclassify,
  $searchItems,
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
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [reclassifyCategory, setReclassifyCategory] = useState('other');
  const [reclassifyMinUsers, setReclassifyMinUsers] = useState(2);
  const [reclassifyLimit, setReclassifyLimit] = useState(80);
  const [reclassifyPrompt, setReclassifyPrompt] = useState('');
  const [reclassifyPreview, setReclassifyPreview] =
    useState<ReclassifyPreviewPayload | null>(null);
  const [reclassifying, setReclassifying] = useState(false);
  const [applyingReclassify, setApplyingReclassify] = useState(false);
  const [reclassifyError, setReclassifyError] = useState<string | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemSearchResults, setItemSearchResults] = useState<
    Array<{ item: string; itemSlug: string; count: number }>
  >([]);
  const [searchingItems, setSearchingItems] = useState(false);
  const [canonicalItem, setCanonicalItem] = useState('');
  const [sourceItems, setSourceItems] = useState<string[]>([]);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeResult, setMergeResult] = useState<string | null>(null);

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
        const [payload, adminPayload] = await Promise.all([
          $getScrapeStatus(),
          $getAdminDashboardData(),
        ]);
        if (!cancelled) {
          setData(payload);
          setAdminData(adminPayload);
          if (adminPayload.categories.length > 0) {
            setReclassifyCategory(adminPayload.categories[0]);
          }
        }
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

  async function refreshAdminData() {
    const payload = await $getAdminDashboardData();
    setAdminData(payload);
  }

  async function runReclassifyPreview() {
    setReclassifyError(null);
    setReclassifying(true);
    setReclassifyPreview(null);

    try {
      const preview = await $previewTagReclassify({
        data: {
          category: reclassifyCategory,
          minUsers: reclassifyMinUsers,
          limit: reclassifyLimit,
          prompt: reclassifyPrompt || undefined,
        },
      });
      setReclassifyPreview(preview);
    } catch (error) {
      setReclassifyError(error instanceof Error ? error.message : 'Failed to preview reclassification.');
    } finally {
      setReclassifying(false);
    }
  }

  async function applyReclassify() {
    if (!reclassifyPreview) return;
    const assignments = reclassifyPreview.output.items.map((item) => ({
      item: item.item,
      categories: item.categories,
    }));

    setApplyingReclassify(true);
    setReclassifyError(null);

    try {
      const result = await $applyTagReclassify({
        data: { category: reclassifyPreview.category, assignments },
      });
      await refreshAdminData();
      setReclassifyError(
        `Applied reclassification: ${result.updatedRows} rows across ${result.updatedItems} items.`
      );
    } catch (error) {
      setReclassifyError(error instanceof Error ? error.message : 'Failed to apply reclassification.');
    } finally {
      setApplyingReclassify(false);
    }
  }

  async function runItemSearch() {
    setSearchingItems(true);
    try {
      const results = await $searchItems({ data: itemSearchQuery });
      setItemSearchResults(results);
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
        data: {
          canonicalItem,
          sourceItems,
        },
      });
      setMergeResult(
        `Merged ${result.mergedItems.length} items into "${result.canonicalItem}" (${result.upsertedRows} row updates, ${result.deletedRows} source rows removed).`
      );
      await Promise.all([refreshAdminData(), runItemSearch()]);
      setSourceItems([]);
    } catch (error) {
      setMergeResult(error instanceof Error ? error.message : 'Failed to merge items.');
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

      {adminData && (
        <>
          <h3 className="text-lg font-semibold pt-6">Admin Controls</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="p-4 space-y-3">
                <h4 className="font-medium">Scrape & Update History</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Total events: <strong>{adminData.scrapeStats.totalEvents}</strong></div>
                  <div>Updated: <strong>{adminData.scrapeStats.updatedEvents}</strong></div>
                  <div>Initial: <strong>{adminData.scrapeStats.initialEvents}</strong></div>
                  <div>Errors: <strong>{adminData.scrapeStats.errorEvents}</strong></div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last event: {adminData.scrapeStats.lastEventAt ? timeAgo(adminData.scrapeStats.lastEventAt) : '—'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <h4 className="font-medium">View Analytics (30d)</h4>
                {!adminData.analytics.available && (
                  <p className="text-xs text-muted-foreground">{adminData.analytics.reason}</p>
                )}
                {adminData.analytics.available && (
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <TopList title="People" items={adminData.analytics.people} />
                    <TopList title="Tags" items={adminData.analytics.tags} />
                    <TopList title="Items" items={adminData.analytics.items} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 space-y-4">
              <h4 className="font-medium">Reclassify tags with prompt</h4>
              <div className="grid gap-2 md:grid-cols-4">
                <select
                  value={reclassifyCategory}
                  onChange={(e) => setReclassifyCategory(e.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {adminData.categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  value={reclassifyMinUsers}
                  onChange={(e) => setReclassifyMinUsers(Number(e.target.value) || 1)}
                  placeholder="Min users"
                />
                <Input
                  type="number"
                  min={1}
                  value={reclassifyLimit}
                  onChange={(e) => setReclassifyLimit(Number(e.target.value) || 1)}
                  placeholder="Item limit"
                />
                <Button onClick={runReclassifyPreview} disabled={reclassifying}>
                  {reclassifying ? 'Previewing...' : 'Preview'}
                </Button>
              </div>
              <textarea
                value={reclassifyPrompt}
                onChange={(e) => setReclassifyPrompt(e.target.value)}
                placeholder="Optional custom prompt"
                className="w-full min-h-[90px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />

              {reclassifyError && (
                <p className="text-xs text-muted-foreground">{reclassifyError}</p>
              )}

              {reclassifyPreview && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Candidate items: {reclassifyPreview.totalCandidates}
                  </p>
                  <div className="max-h-72 overflow-auto rounded-md border p-2 text-sm space-y-1">
                    {reclassifyPreview.output.items.map((entry) => (
                      <div key={entry.item} className="flex items-start justify-between gap-3">
                        <span>{entry.item}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.categories.join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button onClick={applyReclassify} disabled={applyingReclassify}>
                    {applyingReclassify ? 'Applying...' : 'Apply reclassification'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h4 className="font-medium">Merge items into one</h4>
              <div className="flex gap-2">
                <Input
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  placeholder="Search items..."
                />
                <Button onClick={runItemSearch} disabled={searchingItems}>
                  {searchingItems ? 'Searching...' : 'Search'}
                </Button>
              </div>
              <Input
                value={canonicalItem}
                onChange={(e) => setCanonicalItem(e.target.value)}
                placeholder="Canonical item"
              />
              {itemSearchResults.length > 0 && (
                <div className="max-h-56 overflow-auto rounded-md border p-2 space-y-1">
                  {itemSearchResults.map((entry) => (
                    <label key={entry.itemSlug} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{entry.item}</span>
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
              {mergeResult && <p className="text-xs text-muted-foreground">{mergeResult}</p>}
            </CardContent>
          </Card>

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
                    {adminData.recentScrapeEvents
                      .filter((event) => event.changeType === 'updated')
                      .slice(0, 40)
                      .map((event) => (
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
                    {adminData.personScrapeHistory.slice(0, 120).map((row) => (
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
        </>
      )}
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
