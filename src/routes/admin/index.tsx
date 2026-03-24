import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { $getAdminDashboardData, type AdminDashboardData } from '../../server/fn/admin';
import { $getScrapeStatus, type DashboardPayload } from '../../server/fn/profiles';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const Route = createFileRoute('/admin/')({
  component: AdminOverviewPage,
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

function AdminOverviewPage() {
  const [scrapeData, setScrapeData] = useState<DashboardPayload | null>(null);
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [scrape, admin] = await Promise.all([
          $getScrapeStatus(),
          $getAdminDashboardData(),
        ]);
        if (!cancelled) {
          setScrapeData(scrape);
          setAdminData(admin);
        }
      } catch {
        // partial data is fine
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading overview...</p>;

  const errorCount = scrapeData
    ? scrapeData.rows.filter((r) => r.scraped && (!r.statusCode || r.statusCode >= 400)).length
    : 0;
  const pendingCount = scrapeData ? scrapeData.total - scrapeData.scraped : 0;

  return (
    <div className="space-y-6">
      {scrapeData && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Stat label="Total People" value={scrapeData.total} />
          <Stat label="Scraped" value={scrapeData.scraped} className="text-green-500" />
          <Stat label="Vectorized" value={scrapeData.vectorized} className="text-blue-500" />
          <Stat label="Pending" value={pendingCount} className="text-muted-foreground" />
          <Stat label="Errors" value={errorCount} className="text-destructive" />
        </div>
      )}

      {adminData && (
        <div className="grid gap-4 md:grid-cols-2">
          <ScrapeStatsCard stats={adminData.scrapeStats} />
          <AnalyticsCard analytics={adminData.analytics} />
        </div>
      )}

      {adminData && (
        <div className="grid gap-4 md:grid-cols-2">
          <RecentEventsCard events={adminData.recentScrapeEvents} />
          <PersonHistoryCard history={adminData.personScrapeHistory} />
        </div>
      )}
    </div>
  );
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

function TopList({ title, items }: { title: string; items: Array<{ key: string; views: number }> }) {
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
