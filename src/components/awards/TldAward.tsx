import type { AwardDataMap } from '../../server/awards/types';

export function TldAward({ data, variant }: { data: AwardDataMap['most-common-tld']; variant?: 'common' | 'rare' }) {
  const all = [{ tld: data.tld, count: data.count }, ...data.runnersUp];
  const icon = variant === 'rare' ? '💎' : '🌐';
  const maxCount = all[0]?.count ?? 1;

  return (
    <div className="space-y-1.5">
      {all.map((t, i) => {
        const barWidth = Math.max(8, (t.count / maxCount) * 100);
        return (
          <div key={t.tld} className="flex items-center gap-2">
            {i === 0 && <span className="text-base leading-none">{icon}</span>}
            {i > 0 && <span className="w-5" />}
            <span className={`font-mono w-14 shrink-0 ${i === 0 ? 'font-semibold' : 'text-muted-foreground'}`}>
              {t.tld}
            </span>
            <div className="flex-1 h-4 relative">
              <div
                className="absolute inset-y-0 left-0 rounded-sm bg-primary/15"
                style={{ width: `${barWidth}%` }}
              />
              <span className="relative z-10 text-xs text-muted-foreground px-1 leading-4">
                {t.count}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
