import type { AwardDataMap } from '../../server/awards/types';
import { PersonAvatar, PersonLink, RankedRow } from './primitives';

export function MostGithubContributionsAward({ data }: { data: AwardDataMap['most-github-contributions'] }) {
  if (data.contributors.length === 0) {
    return <span className="text-muted-foreground">No contribution data yet</span>;
  }

  const maxContrib = data.contributors[0]?.contributions ?? 1;

  return (
    <div className="space-y-2">
      {data.contributors.map((c, i) => {
        const barWidth = Math.max(8, (c.contributions / maxContrib) * 100);
        return (
          <RankedRow key={c.person.personSlug} place={i}>
            <PersonAvatar person={c.person} size={i === 0 ? 28 : 22} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <PersonLink name={c.person.name} slug={c.person.personSlug} />
                <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                  {c.contributions.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted mt-0.5">
                <div
                  className="h-full rounded-full bg-green-500/60"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          </RankedRow>
        );
      })}
      <p className="text-[10px] text-muted-foreground text-center italic">contributions in the last year</p>
    </div>
  );
}
