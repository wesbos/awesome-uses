import type { AwardDataMap } from '../../server/awards/types';
import { PersonLink, Stat } from './primitives';

export function DomainLengthAward({ data }: { data: AwardDataMap['longest-domain'] }) {
  return (
    <div>
      <Stat>{data.domain}</Stat>
      <span className="text-muted-foreground">
        {' '}— <PersonLink name={data.person.name} slug={data.person.personSlug} />
      </span>
    </div>
  );
}
