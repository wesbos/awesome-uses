import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  apiGetAvatarStatus,
  apiGenerateAvatarBatch,
  apiRetryFailedAvatars,
  apiClearFailedAvatars,
  apiFlagMissingAvatarsInR2,
  apiMarkAvatarPersonFailed,
  apiMarkPendingAvatarsFailed,
  type AvatarStatusPayload,
  type AvatarStatusRow,
} from '../../lib/site-management-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/admin/avatars')({
  component: AvatarsPage,
});

function AvatarsPage() {
  const [status, setStatus] = useState<AvatarStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [regenFailedBusy, setRegenFailedBusy] = useState(false);
  const [clearingFailed, setClearingFailed] = useState(false);
  const [flaggingMissing, setFlaggingMissing] = useState(false);
  const [markingSlug, setMarkingSlug] = useState<string | null>(null);
  const [markingPendingFailed, setMarkingPendingFailed] = useState(false);

  async function loadStatus() {
    setLoading(true);
    try {
      const data = await apiGetAvatarStatus();
      setStatus(data);
    } catch (err) {
      console.log('[avatars UI] Failed to load status:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await apiGenerateAvatarBatch({ count: 9 });
      toast.success(result.message);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      const result = await apiRetryFailedAvatars();
      toast.success(`Reset ${result.reset} failed/skipped row(s) to pending (they’ll be picked first on the next batch).`);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed.');
    } finally {
      setRetrying(false);
    }
  }

  async function handleRegenerateFailed() {
    setRegenFailedBusy(true);
    try {
      const result = await apiGenerateAvatarBatch({ count: 9, failedOnly: true });
      toast.success(result.message);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Regenerate failed.');
    } finally {
      setRegenFailedBusy(false);
    }
  }

  async function handleClearFailed() {
    if (!status?.failed && !status?.skipped) return;
    setClearingFailed(true);
    try {
      const result = await apiClearFailedAvatars();
      toast.success(result.message);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Clear failed.');
    } finally {
      setClearingFailed(false);
    }
  }

  async function handleFlagMissingFromR2() {
    setFlaggingMissing(true);
    try {
      const result = await apiFlagMissingAvatarsInR2();
      toast.success(result.message);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Flag missing failed.');
    } finally {
      setFlaggingMissing(false);
    }
  }

  async function handleMarkSingleFailed(personSlug: string) {
    setMarkingSlug(personSlug);
    try {
      const result = await apiMarkAvatarPersonFailed(personSlug);
      toast.success(result.message);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mark failed.');
    } finally {
      setMarkingSlug(null);
    }
  }

  async function handleMarkPendingFailed() {
    setMarkingPendingFailed(true);
    try {
      const result = await apiMarkPendingAvatarsFailed();
      toast.success(result.message);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mark pending as failed.');
    } finally {
      setMarkingPendingFailed(false);
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Stippled Avatar Generation</h3>

      {/* Status cards */}
      {status && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <StatCard label="Total" value={status.total} />
          <StatCard label="Completed" value={status.completed} variant="success" />
          <StatCard label="Pending" value={status.pending} />
          <StatCard label="Processing" value={status.processing} variant="warning" />
          <StatCard label="Failed" value={status.failed} variant="destructive" />
          <StatCard label="Skipped (no source)" value={status.skipped} variant="warning" />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleGenerate} disabled={generating || loading} size="sm">
          {generating ? 'Generating...' : 'Generate batch (9)'}
        </Button>
        <Button
          onClick={handleFlagMissingFromR2}
          disabled={flaggingMissing || loading || !status?.completed}
          size="sm"
          variant="secondary"
        >
          {flaggingMissing ? 'Checking R2…' : 'Flag completed without R2 file'}
        </Button>
        <Button
          onClick={handleRegenerateFailed}
          disabled={regenFailedBusy || loading || !status?.failed}
          size="sm"
          variant="default"
        >
          {regenFailedBusy ? 'Regenerating...' : 'Regenerate failed (9)'}
        </Button>
        <Button
          onClick={handleRetry}
          disabled={retrying || loading || (!status?.failed && !status?.skipped)}
          size="sm"
          variant="outline"
        >
          {retrying ? 'Working...' : 'Mark failed/skipped → pending'}
        </Button>
        <Button
          onClick={handleMarkPendingFailed}
          disabled={markingPendingFailed || loading || !status?.pending}
          size="sm"
          variant="outline"
        >
          {markingPendingFailed ? 'Working...' : 'Mark pending → failed'}
        </Button>
        <Button
          onClick={handleClearFailed}
          disabled={clearingFailed || loading || (!status?.failed && !status?.skipped)}
          size="sm"
          variant="outline"
        >
          {clearingFailed ? 'Clearing...' : 'Clear failed/skipped records'}
        </Button>
        <Button onClick={loadStatus} disabled={loading} size="sm" variant="ghost">
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground max-w-2xl">
        Rows are only <strong>completed</strong> after a successful R2 upload. People whose
        source photo 404s are marked <strong>skipped (no source)</strong> and won't be retried
        until you clear or reset them.{' '}
        <strong>Flag completed without R2 file</strong> finds old “completed” rows with no PNG in the bucket
        and marks them failed — then use <strong>Regenerate failed</strong>.{' '}
        <strong>Mark failed → pending</strong> / <strong>Clear failed</strong> work as before.
      </p>

      {/* Avatar gallery */}
      {status && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {status.rows
            .filter((row) => row.status !== 'none')
            .map((row) => (
              <AvatarCard
                key={row.personSlug}
                row={row}
                markBusy={markingSlug === row.personSlug}
                onMarkForRegen={
                  row.status === 'completed'
                    ? () => void handleMarkSingleFailed(row.personSlug)
                    : undefined
                }
              />
            ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: 'success' | 'warning' | 'destructive';
}) {
  const colorClass =
    variant === 'success'
      ? 'text-green-600'
      : variant === 'warning'
        ? 'text-yellow-600'
        : variant === 'destructive'
          ? 'text-red-600'
          : 'text-foreground';

  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function AvatarCard({
  row,
  onMarkForRegen,
  markBusy,
}: {
  row: AvatarStatusRow;
  onMarkForRegen?: () => void;
  markBusy?: boolean;
}) {
  const statusVariant =
    row.status === 'completed'
      ? 'default'
      : row.status === 'failed' || row.status === 'skipped_no_source'
        ? 'destructive'
        : 'secondary';

  const cacheBust = row.generatedAt ? `?v=${new Date(row.generatedAt).getTime()}` : '';
  const stippledSrc = `/api/avatar/${row.personSlug}${cacheBust}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const stippledRef = useRef<HTMLImageElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el || !stippledRef.current) return;
    const rect = el.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    stippledRef.current.style.clipPath = `inset(0 0 0 ${pct}%)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (stippledRef.current) {
      stippledRef.current.style.clipPath = 'inset(0 0 0 50%)';
    }
  }, []);

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div
          ref={containerRef}
          className="relative aspect-square overflow-hidden rounded bg-muted"
          onMouseMove={row.status === 'completed' ? handleMouseMove : undefined}
          onMouseLeave={row.status === 'completed' ? handleMouseLeave : undefined}
        >
          {row.status === 'completed' ? (
            <>
              <img
                src={row.sourceAvatarUrl}
                alt=""
                loading="lazy"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                aria-hidden
              />
              <img
                ref={stippledRef}
                src={stippledSrc}
                alt={row.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ clipPath: 'inset(0 0 0 50%)' }}
              />
              <div className="pointer-events-none absolute inset-0 flex items-end justify-between px-1.5 pb-1 text-[10px] font-medium text-muted-foreground">
                <span className="rounded bg-background/80 px-1 py-0.5">Original</span>
                <span className="rounded bg-background/80 px-1 py-0.5">Stippled</span>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No avatar
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Link
            to="/people/$personSlug"
            params={{ personSlug: row.personSlug }}
            className="text-xs font-medium truncate block hover:underline"
            title={row.name}
          >
            {row.name}
          </Link>
          <Badge variant={statusVariant} className="text-[10px]">
            {row.status === 'skipped_no_source' ? 'no source' : row.status}
          </Badge>
          {row.error && (
            <p className="text-[10px] text-destructive truncate" title={row.error}>
              {row.error}
            </p>
          )}
          {onMarkForRegen && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-full text-[10px]"
              disabled={markBusy}
              onClick={onMarkForRegen}
            >
              {markBusy ? '…' : 'Mark for regen'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
