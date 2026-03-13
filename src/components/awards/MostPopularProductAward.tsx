import { Link } from '@tanstack/react-router';
import type { AwardDataMap } from '../../server/awards/types';
import { Stat } from './primitives';

export function MostPopularProductAward({ data }: { data: AwardDataMap['most-popular-product'] }) {
  return (
    <div>
      <Link to="/items/$itemSlug" params={{ itemSlug: data.itemSlug }} className="hover:underline">
        <Stat>{data.item}</Stat>
      </Link>
      <span className="text-muted-foreground"> ({data.count} devs)</span>
    </div>
  );
}
