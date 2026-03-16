import type { AwardDataMap } from '../../server/awards/types';
import { RankedRow } from './primitives';

export function MostPopularLanguageAward({ data }: { data: AwardDataMap['most-popular-language'] }) {
  const all = [
    { language: data.language, color: data.color, devCount: data.devCount },
    ...data.runnersUp,
  ];

  return (
    <div className="space-y-1.5">
      {all.map((lang, i) => (
        <RankedRow key={lang.language} place={i}>
          <span
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: lang.color }}
          />
          <span className={i === 0 ? 'font-semibold' : ''}>{lang.language}</span>
          <span className="text-muted-foreground ml-auto tabular-nums">{lang.devCount} devs</span>
        </RankedRow>
      ))}
    </div>
  );
}
