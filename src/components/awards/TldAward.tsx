import type { AwardDataMap } from '../../server/awards/types';
import { Stat } from './primitives';

export function TldAward({ data }: { data: AwardDataMap['most-common-tld'] }) {
  return (
    <div className="space-y-0.5">
      {[{ tld: data.tld, count: data.count }, ...data.runnersUp].map((t) => (
        <div key={t.tld} className="flex justify-between max-w-48">
          <Stat>{t.tld}</Stat>
          <span className="text-muted-foreground">{t.count}</span>
        </div>
      ))}
    </div>
  );
}
