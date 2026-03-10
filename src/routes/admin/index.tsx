import { createFileRoute } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { apiGetScrapeStatus } from '../../lib/site-management-api';
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
  const { data: scrapeData, isLoading } = useQuery({
    queryKey: ['site-tools', 'pipeline.getScrapeStatus'],
    queryFn: apiGetScrapeStatus,
    enabled: typeof window !== 'undefined',
  });

  if (isLoading) return <p className="text-muted-foreground">Loading overview...</p>;
  if (!scrapeData) return <p className="text-muted-foreground">Unable to load overview data.</p>;

  const errorCount = scrapeData
    .rows.filter((r) => r.scraped && (!r.statusCode || r.statusCode >= 400)).length;
  const pendingCount = scrapeData.total - scrapeData.scraped;
  const recent = scrapeData.rows
    .filter((entry) => entry.fetchedAt)
    .sort((a, b) => (b.fetchedAt ?? '').localeCompare(a.fetchedAt ?? ''))
    .slice(0, 40);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Stat label="Total People" value={scrapeData.total} />
        <Stat label="Scraped" value={scrapeData.scraped} className="text-green-500" />
        <Stat label="Vectorized" value={scrapeData.vectorized} className="text-blue-500" />
        <Stat label="Pending" value={pendingCount} className="text-muted-foreground" />
        <Stat label="Errors" value={errorCount} className="text-destructive" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h4 className="font-medium">Unified admin tooling</h4>
          <p className="text-sm text-muted-foreground">
            All admin operations now run through the shared site-management REST/MCP APIs.
          </p>
          <Link to="/admin/tools" className="text-sm underline">
            Open tooling docs
          </Link>
        </CardContent>
      </Card>

      <RecentRowsCard rows={recent} />
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

function RecentRowsCard({
  rows,
}: {
  rows: Array<{
    personSlug: string;
    name: string;
    fetchedAt: string | null;
    statusCode: number | null;
    vectorized: boolean;
  }>;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h4 className="font-medium">Recently scraped profiles</h4>
        <div className="max-h-64 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vectorized</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.personSlug}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.statusCode ?? '—'}</TableCell>
                  <TableCell>{row.vectorized ? 'yes' : '—'}</TableCell>
                  <TableCell>{row.fetchedAt ? timeAgo(row.fetchedAt) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
