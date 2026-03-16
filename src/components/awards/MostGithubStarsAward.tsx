import type { AwardDataMap } from '../../server/awards/types';
import { PersonAvatar, RankedRow } from './primitives';

export function MostGithubStarsAward({ data }: { data: AwardDataMap['most-github-stars'] }) {
  if (data.repos.length === 0) {
    return <span className="text-muted-foreground">No star data yet</span>;
  }

  return (
    <div className="space-y-2">
      {data.repos.map((r, i) => (
        <RankedRow key={r.repoUrl} place={i}>
          <PersonAvatar person={r.person} size={22} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <a
                href={r.repoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold hover:underline truncate"
              >
                {r.repoName}
              </a>
              <span className="text-xs text-muted-foreground shrink-0">
                by {r.person.name}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>⭐</span>
              <span className="tabular-nums font-semibold text-foreground">{r.stars.toLocaleString()}</span>
            </div>
          </div>
        </RankedRow>
      ))}
    </div>
  );
}
