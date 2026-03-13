import type { AwardDataMap } from '../../server/awards/types';
import { PersonLink } from './primitives';

export function NameLengthAward({ data }: { data: AwardDataMap['longest-name'] }) {
  return (
    <div>
      <PersonLink name={data.person.name} slug={data.person.personSlug} />
      <span className="text-muted-foreground"> ({data.length} chars)</span>
    </div>
  );
}
