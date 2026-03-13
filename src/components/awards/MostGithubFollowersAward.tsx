import type { AwardDataMap } from '../../server/awards/types';
import { PersonLink } from './primitives';

export function MostGithubFollowersAward({ data }: { data: AwardDataMap['most-github-followers'] }) {
  return (
    <div>
      <PersonLink name={data.person.name} slug={data.person.personSlug} />
      <span className="text-muted-foreground"> ({data.followers.toLocaleString()} followers)</span>
    </div>
  );
}
