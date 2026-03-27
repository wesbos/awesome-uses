import { Link } from '@tanstack/react-router';
import type { AwardDataMap } from '../../server/awards/types';
import { Medal } from './primitives';

export function MostPopularTagAward({ data }: { data: AwardDataMap['most-popular-tag'] }) {
  const all = [{ tag: data.tag, count: data.count }, ...data.runnersUp];

  return (
    <div className="space-y-1.5">
      {all.map((t, i) => (
        <div key={t.tag} className="flex items-center gap-2">
          <Medal place={i} />
          <Link
            to="/like/$tag"
            params={{ tag: t.tag }}
            className="rounded-full border px-2.5 py-0.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            {t.tag}
          </Link>
          <span className="text-muted-foreground text-xs tabular-nums ml-auto">
            {t.count} people
          </span>
        </div>
      ))}
    </div>
  );
}
