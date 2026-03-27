import { Link } from '@tanstack/react-router';
import type { AwardDataMap } from '../../server/awards/types';
import { Medal } from './primitives';

export function MostPopularProductAward({ data }: { data: AwardDataMap['most-popular-product'] }) {
  const all = [
    { item: data.item, itemSlug: data.itemSlug, count: data.count },
    ...data.runnersUp,
  ];
  const maxCount = all[0]?.count ?? 1;

  return (
    <div className="space-y-1.5">
      {all.map((p, i) => {
        const barWidth = Math.max(8, (p.count / maxCount) * 100);
        return (
          <div key={p.itemSlug} className="flex items-center gap-2">
            <Medal place={i} />
            <Link
              to="/items/$itemSlug"
              params={{ itemSlug: p.itemSlug }}
              className={`hover:underline truncate shrink-0 ${i === 0 ? 'font-semibold' : ''}`}
            >
              {p.item}
            </Link>
            <div className="flex-1 h-4 relative ml-1">
              <div
                className="absolute inset-y-0 left-0 rounded-sm bg-primary/15"
                style={{ width: `${barWidth}%` }}
              />
              <span className="relative z-10 text-xs text-muted-foreground px-1 leading-4 tabular-nums">
                {p.count}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
