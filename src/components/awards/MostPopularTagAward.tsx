import { Link } from '@tanstack/react-router';
import type { AwardDataMap } from '../../server/awards/types';
import { Stat } from './primitives';

export function MostPopularTagAward({ data }: { data: AwardDataMap['most-popular-tag'] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {[{ tag: data.tag, count: data.count }, ...data.runnersUp].map((t) => (
        <Link key={t.tag} to="/like/$tag" params={{ tag: t.tag }} className="hover:underline">
          <Stat>{t.tag}</Stat>
          <span className="text-muted-foreground"> ({t.count})</span>
        </Link>
      ))}
    </div>
  );
}
