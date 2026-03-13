import type { AwardDataMap } from '../../server/awards/types';
import { PersonLink } from './primitives';

export function PeopleSimilarityAward({ data }: { data: AwardDataMap['most-similar-people'] }) {
  return (
    <div>
      <PersonLink name={data.personA.name} slug={data.personA.personSlug} />
      <span className="text-muted-foreground"> & </span>
      <PersonLink name={data.personB.name} slug={data.personB.personSlug} />
      <span className="text-muted-foreground"> ({data.score} similarity)</span>
    </div>
  );
}
