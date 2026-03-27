import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ExtractionReviewData } from '../../lib/site-management-api';
import type { DiscoverTagsResult } from '../../server/fn/admin';
import { apiDiscoverTags, apiGetExtractionReview } from '../../lib/site-management-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const Route = createFileRoute('/admin/review')({
  component: ReviewPage,
});

function ReviewPage() {
  return (
    <div className="space-y-6">
      <ExtractionReviewCard />
      <DiscoverTagsCard />
    </div>
  );
}

function ExtractionReviewCard() {
  const [enabled, setEnabled] = useState(false);
  const { data, isFetching, refetch } = useQuery<ExtractionReviewData | null>({
    queryKey: ['site-tools', 'pipeline.reviewExtraction'],
    queryFn: apiGetExtractionReview,
    enabled,
    retry: false,
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h4 className="font-medium">Extraction Review</h4>
        <p className="text-xs text-muted-foreground">
          Quality report on extracted items: tag breakdown, duplicates, and issues.
        </p>
        <Button
          onClick={async () => {
            if (!enabled) setEnabled(true);
            await refetch();
          }}
          disabled={isFetching}
          size="sm"
        >
          {isFetching ? 'Loading...' : data ? 'Refresh' : 'Load Review'}
        </Button>
        {data && (
          <div className="text-xs space-y-4">
            <p>
              Total rows: <strong>{data.totalRows}</strong> | Tags: <strong>{data.totalTags}</strong>
            </p>

            <div>
              <h5 className="font-medium mb-1">Tags ({data.tags.length})</h5>
              <div className="max-h-56 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tag</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>People</TableHead>
                      <TableHead>Top items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tags.slice(0, 40).map((c: ExtractionReviewData['tags'][number]) => (
                      <TableRow key={c.tag}>
                        <TableCell className="font-medium">{c.tag}</TableCell>
                        <TableCell>{c.uniqueItems}</TableCell>
                        <TableCell>{c.totalPeople}</TableCell>
                        <TableCell className="max-w-[300px] truncate text-muted-foreground">
                          {c.topItems.slice(0, 5).map((i: { item: string; count: number }) => i.item).join(', ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {data.bannedLeaks.length > 0 && (
              <div>
                <h5 className="font-medium mb-1 text-destructive">Banned Tag Leaks</h5>
                <div className="rounded-md border p-2 space-y-0.5">
                  {data.bannedLeaks.map((b: ExtractionReviewData['bannedLeaks'][number]) => (
                    <div key={b.tag} className="flex justify-between">
                      <span>{b.tag}</span>
                      <span className="text-muted-foreground">{b.uniqueItems} items</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.multiTagItems.length > 0 && (
              <div>
                <h5 className="font-medium mb-1">Items in 3+ tags</h5>
                <div className="max-h-40 overflow-auto rounded-md border p-2 space-y-0.5">
                  {data.multiTagItems.map((m: ExtractionReviewData['multiTagItems'][number]) => (
                    <div key={m.item} className="flex justify-between gap-2">
                      <span className="truncate">{m.item}</span>
                      <span className="text-muted-foreground shrink-0">{m.tags.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.tinyTags.length > 0 && (
              <div>
                <h5 className="font-medium mb-1">Tiny tags (&le;2 items)</h5>
                <div className="max-h-40 overflow-auto rounded-md border p-2 space-y-0.5">
                  {data.tinyTags.map((t: ExtractionReviewData['tinyTags'][number]) => (
                    <div key={t.tag} className="flex justify-between gap-2">
                      <span>{t.tag}</span>
                      <span className="text-muted-foreground truncate">{t.items.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DiscoverTagsCard() {
  const [sampleSize, setSampleSize] = useState(30);
  const [result, setResult] = useState<DiscoverTagsResult | null>(null);
  const discoverMutation = useMutation({
    mutationFn: (value: number) => apiDiscoverTags(value),
  });

  async function run() {
    setResult(null);
    try {
      const res = await discoverMutation.mutateAsync(sampleSize);
      setResult(res);
    } catch {
      setResult(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h4 className="font-medium">Discover Tags</h4>
        <p className="text-xs text-muted-foreground">
          Sample random pages, extract items via AI, and see tag/item frequency.
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={5}
            max={200}
            value={sampleSize}
            onChange={(e) => setSampleSize(Number(e.target.value) || 30)}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">pages</span>
          <Button onClick={run} disabled={discoverMutation.isPending} size="sm">
            {discoverMutation.isPending ? 'Discovering...' : 'Run'}
          </Button>
        </div>
        {result && (
          <div className="text-xs space-y-3">
            <p>
              Sampled: <strong>{result.sampledPages}</strong> | Items found: <strong>{result.totalItems}</strong> | Errors: <strong>{result.errors}</strong>
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h5 className="font-medium mb-1">Top Tags</h5>
                <div className="max-h-56 overflow-auto rounded-md border p-2 space-y-0.5">
                  {result.topTags.map((t) => (
                    <div key={t.tag} className="flex justify-between">
                      <span>{t.tag}</span>
                      <span className="text-muted-foreground">{t.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h5 className="font-medium mb-1">Top Items</h5>
                <div className="max-h-56 overflow-auto rounded-md border p-2 space-y-0.5">
                  {result.topItems.map((i) => (
                    <div key={i.item} className="flex justify-between">
                      <span>{i.item}</span>
                      <span className="text-muted-foreground">{i.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
