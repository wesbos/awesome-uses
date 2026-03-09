import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ExtractionReviewData } from '../../server/fn/items';
import type { DiscoverCategoriesResult } from '../../server/fn/admin';
import { apiDiscoverCategories, apiGetExtractionReview } from '../../lib/site-management-api';
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
      <DiscoverCategoriesCard />
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
          Quality report on extracted items: category breakdown, duplicates, and issues.
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
              Total rows: <strong>{data.totalRows}</strong> | Categories: <strong>{data.totalCategories}</strong>
            </p>

            <div>
              <h5 className="font-medium mb-1">Categories ({data.categories.length})</h5>
              <div className="max-h-56 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>People</TableHead>
                      <TableHead>Top items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.categories.slice(0, 40).map((c) => (
                      <TableRow key={c.category}>
                        <TableCell className="font-medium">{c.category}</TableCell>
                        <TableCell>{c.uniqueItems}</TableCell>
                        <TableCell>{c.totalPeople}</TableCell>
                        <TableCell className="max-w-[300px] truncate text-muted-foreground">
                          {c.topItems.slice(0, 5).map((i) => i.item).join(', ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {data.bannedLeaks.length > 0 && (
              <div>
                <h5 className="font-medium mb-1 text-destructive">Banned Category Leaks</h5>
                <div className="rounded-md border p-2 space-y-0.5">
                  {data.bannedLeaks.map((b) => (
                    <div key={b.category} className="flex justify-between">
                      <span>{b.category}</span>
                      <span className="text-muted-foreground">{b.uniqueItems} items</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.multiCategoryItems.length > 0 && (
              <div>
                <h5 className="font-medium mb-1">Items in 3+ categories</h5>
                <div className="max-h-40 overflow-auto rounded-md border p-2 space-y-0.5">
                  {data.multiCategoryItems.map((m) => (
                    <div key={m.item} className="flex justify-between gap-2">
                      <span className="truncate">{m.item}</span>
                      <span className="text-muted-foreground shrink-0">{m.categories.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.tinyCategories.length > 0 && (
              <div>
                <h5 className="font-medium mb-1">Tiny categories (&le;2 items)</h5>
                <div className="max-h-40 overflow-auto rounded-md border p-2 space-y-0.5">
                  {data.tinyCategories.map((t) => (
                    <div key={t.category} className="flex justify-between gap-2">
                      <span>{t.category}</span>
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

function DiscoverCategoriesCard() {
  const [sampleSize, setSampleSize] = useState(30);
  const [result, setResult] = useState<DiscoverCategoriesResult | null>(null);
  const discoverMutation = useMutation({
    mutationFn: (value: number) => apiDiscoverCategories(value),
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
        <h4 className="font-medium">Discover Categories</h4>
        <p className="text-xs text-muted-foreground">
          Sample random pages, extract items via AI, and see category/item frequency.
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
                <h5 className="font-medium mb-1">Top Categories</h5>
                <div className="max-h-56 overflow-auto rounded-md border p-2 space-y-0.5">
                  {result.topCategories.map((c) => (
                    <div key={c.category} className="flex justify-between">
                      <span>{c.category}</span>
                      <span className="text-muted-foreground">{c.count}</span>
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
