import type { AwardDataMap } from '../../server/awards/types';
import { PersonAvatar, PersonLink, RankedRow } from './primitives';

export function MostGithubFollowersAward({ data }: { data: AwardDataMap['most-github-followers'] }) {
  const all = [
    { ...data.person, followers: data.followers },
    ...data.runnersUp,
  ];

  return (
    <div className="space-y-2">
      {all.map((p, i) => (
        <RankedRow key={p.personSlug} place={i}>
          <PersonAvatar person={p} size={i === 0 ? 32 : 24} />
          <div className="min-w-0">
            <PersonLink name={p.name} slug={p.personSlug} />
            <p className="text-xs text-muted-foreground">
              {p.followers.toLocaleString()} followers
            </p>
          </div>
        </RankedRow>
      ))}
    </div>
  );
}
