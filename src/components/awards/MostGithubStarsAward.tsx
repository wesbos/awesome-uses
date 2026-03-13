import type { AwardDataMap } from '../../server/awards/types';
import { PersonLink, Stat } from './primitives';

export function MostGithubStarsAward({ data }: { data: AwardDataMap['most-github-stars'] }) {
  if (data.repos.length === 0) {
    return <span className="text-muted-foreground">No star data yet</span>;
  }

  return (
    <div className="space-y-1">
      {data.repos.map((r) => (
        <div key={r.repoUrl} className="flex items-baseline gap-2">
          <a href={r.repoUrl} target="_blank" rel="noreferrer noopener" className="hover:underline truncate">
            <Stat>{r.repoName}</Stat>
          </a>
          <span className="text-muted-foreground shrink-0">{r.stars.toLocaleString()} stars</span>
          <span className="text-muted-foreground shrink-0">—</span>
          <PersonLink name={r.person.name} slug={r.person.personSlug} />
        </div>
      ))}
    </div>
  );
}
