import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { $getAwards, $recalculateAllAwards, $recalculateAward } from '../../server/fn/awards';
import { ALL_AWARD_KEYS } from '../../server/awards/registry';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { AnyAward } from '../../server/awards/types';

export const Route = createFileRoute('/admin/awards')({
  component: AdminAwardsPage,
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

function AdminAwardsPage() {
  const queryClient = useQueryClient();
  const { data: awards = [], isLoading } = useQuery({
    queryKey: ['awards'],
    queryFn: () => $getAwards(),
    enabled: typeof window !== 'undefined',
  });

  const recalcAllMutation = useMutation({
    mutationFn: () => $recalculateAllAwards(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awards'] });
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Loading awards...</p>;

  const awardMap = new Map(awards.map((a) => [a.awardKey, a]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Awards</h3>
          <p className="text-sm text-muted-foreground">
            {awards.length} of {ALL_AWARD_KEYS.length} awards calculated
          </p>
        </div>
        <Button
          onClick={() => recalcAllMutation.mutate()}
          disabled={recalcAllMutation.isPending}
        >
          {recalcAllMutation.isPending ? 'Calculating...' : 'Recalculate All'}
        </Button>
      </div>

      {recalcAllMutation.data && (
        <Card>
          <CardContent className="p-4 text-sm">
            <p className="text-green-500">
              Calculated: {recalcAllMutation.data.calculated.length} awards
            </p>
            {recalcAllMutation.data.failed.length > 0 && (
              <p className="text-destructive">
                Failed: {recalcAllMutation.data.failed.join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ALL_AWARD_KEYS.map((key) => (
          <AwardAdminCard key={key} awardKey={key} award={awardMap.get(key) ?? null} />
        ))}
      </div>
    </div>
  );
}

function AwardAdminCard({ awardKey, award }: { awardKey: string; award: AnyAward | null }) {
  const queryClient = useQueryClient();
  const recalcMutation = useMutation({
    mutationFn: () => $recalculateAward({ data: awardKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awards'] });
    },
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-medium text-sm">{award?.title ?? awardKey}</h4>
            {award?.description && (
              <p className="text-xs text-muted-foreground">{award.description}</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recalcMutation.mutate()}
            disabled={recalcMutation.isPending}
          >
            {recalcMutation.isPending ? '...' : 'Recalc'}
          </Button>
        </div>

        {recalcMutation.error && (
          <p className="text-xs text-destructive">
            Error: {recalcMutation.error instanceof Error ? recalcMutation.error.message : 'Calculation failed'}
          </p>
        )}

        {award ? (
          <div className="text-xs space-y-1">
            <p className="text-muted-foreground">
              Last calculated: {timeAgo(award.calculatedAt)}
            </p>
            <pre className="bg-muted rounded p-2 overflow-x-auto max-h-32 text-[10px]">
              {JSON.stringify(award.data, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Not yet calculated</p>
        )}
      </CardContent>
    </Card>
  );
}
