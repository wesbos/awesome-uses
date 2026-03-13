import type { AwardDataMap } from '../../server/awards/types';
import { PersonLink, Stat } from './primitives';

export function MostGithubContributionsAward({ data }: { data: AwardDataMap['most-github-contributions'] }) {
  if (data.contributors.length === 0) {
    return <span className="text-muted-foreground">No contribution data yet</span>;
  }

  return (
    <div className="space-y-0.5">
      {data.contributors.map((c) => (
        <div key={c.person.personSlug} className="flex justify-between max-w-72">
          <PersonLink name={c.person.name} slug={c.person.personSlug} />
          <Stat>{c.contributions.toLocaleString()}</Stat>
        </div>
      ))}
    </div>
  );
}
