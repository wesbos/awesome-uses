import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
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

export const Route = createFileRoute('/admin/github')({
  component: GitHubPage,
});

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

type FilterMode = 'all' | 'fetched' | 'expired' | 'pending';

function GitHubPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['site-tools', 'pipeline.getGitHubStatus'],
    queryFn: apiGetGitHubStatus,
  });

  const fetchOne = useMutation({
    mutationFn: ({ personSlug, force }: { personSlug: string; force: boolean }) =>
      apiFetchGitHubProfile(personSlug, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-tools', 'pipeline.getGitHubStatus'] });
    },
  });

  const fetchBatch = useMutation({
    mutationFn: (input: { limit?: number; concurrency?: number; pendingOnly?: boolean }) =>
      apiFetchGitHubBatch(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-tools', 'pipeline.getGitHubStatus'] });
    },
  });

  if (isLoading || !data) return <p className="p-4 text-sm text-muted-foreground">Loading...</p>;

  const filtered = data.rows.filter((row) => {
    if (search) {
      const q = search.toLowerCase();
      if (!row.name.toLowerCase().includes(q) && !row.github.toLowerCase().includes(q) && !row.personSlug.includes(q)) {
        return false;
      }
    }
    switch (filter) {
      case 'fetched': return row.fetched && !row.expired;
      case 'expired': return row.fetched && row.expired;
      case 'pending': return !row.fetched;
      default: return true;
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">GitHub Profiles</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={fetchBatch.isPending}
            onClick={() => fetchBatch.mutate({ limit: 50, concurrency: 3, pendingOnly: true })}
          >
            {fetchBatch.isPending ? 'Fetching...' : 'Fetch Pending (50)'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-3 text-center text-sm">
            <div>
              <div className="text-2xl font-bold">{data.total}</div>
              <div className="text-muted-foreground">With GitHub</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{data.fetched}</div>
              <div className="text-muted-foreground">Fetched</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{data.fresh}</div>
              <div className="text-muted-foreground">Fresh</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{data.expired}</div>
              <div className="text-muted-foreground">Expired</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {fetchBatch.data && (
        <Card>
          <CardContent className="p-3 text-sm">
            Batch complete: {fetchBatch.data.successes} fetched, {fetchBatch.data.failures} failed
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 items-center">
        <Input
          placeholder="Search by name or GitHub username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {(['all', 'fetched', 'expired', 'pending'] as FilterMode[]).map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={filter === mode ? 'default' : 'outline'}
            onClick={() => setFilter(mode)}
          >
            {mode}
          </Button>
        ))}
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} rows</span>
      </div>

      <div className="rounded-md border overflow-auto max-h-[70vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>GitHub</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fetched</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <GitHubRow
                key={row.personSlug}
                row={row}
                onFetch={(force) => fetchOne.mutate({ personSlug: row.personSlug, force })}
                isFetching={fetchOne.isPending && fetchOne.variables?.personSlug === row.personSlug}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function GitHubRow({
  row,
  onFetch,
  isFetching,
}: {
  row: GitHubStatusRow;
  onFetch: (force: boolean) => void;
  isFetching: boolean;
}) {
  return (
    <TableRow>
      <TableCell>
        <Link
          to="/people/$personSlug"
          params={{ personSlug: row.personSlug }}
          className="hover:underline text-sm"
        >
          {row.name}
        </Link>
      </TableCell>
      <TableCell>
        <a
          href={`https://github.com/${row.github}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          @{row.github}
        </a>
      </TableCell>
      <TableCell>
        {!row.fetched && <Badge variant="outline">Pending</Badge>}
        {row.fetched && !row.expired && <Badge variant="secondary">Fresh</Badge>}
        {row.fetched && row.expired && <Badge variant="destructive">Expired</Badge>}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {row.fetchedAt ? timeAgo(row.fetchedAt) : '-'}
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="outline"
          disabled={isFetching}
          onClick={() => onFetch(row.fetched && !row.expired)}
        >
          {isFetching ? '...' : row.fetched && !row.expired ? 'Refresh' : 'Fetch'}
        </Button>
      </TableCell>
    </TableRow>
  );
}
