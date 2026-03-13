import type { AwardDataMap } from '../../server/awards/types';
import { Stat } from './primitives';

export function MostPopularLanguageAward({ data }: { data: AwardDataMap['most-popular-language'] }) {
  return (
    <div>
      <Stat>{data.language}</Stat>
      <span className="text-muted-foreground"> ({data.devCount} devs)</span>
      {data.runnersUp.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {data.runnersUp.map((r) => (
            <div key={r.language} className="flex justify-between max-w-48">
              <span className="text-muted-foreground">{r.language}</span>
              <span className="text-muted-foreground">{r.devCount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
