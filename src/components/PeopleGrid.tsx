import { useMemo, useState } from 'react';
import type { Person } from '../lib/types';
import PersonCard from './PersonCard';

const CHUNK_SIZE = 60;

type PeopleGridProps = {
  people: Person[];
  activeTagName?: string;
  tagSlugByName: Record<string, string>;
};

export default function PeopleGrid({
  people,
  activeTagName,
  tagSlugByName,
}: PeopleGridProps) {
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const visiblePeople = useMemo(
    () => people.slice(0, visibleCount),
    [people, visibleCount]
  );

  const canLoadMore = visibleCount < people.length;

  return (
    <>
      <div className="People">
        {visiblePeople.map((person) => (
          <PersonCard
            key={person.personSlug}
            person={person}
            activeTagName={activeTagName}
            tagSlugByName={tagSlugByName}
          />
        ))}
      </div>

      {canLoadMore && (
        <div className="PeopleGridActions">
          <button
            type="button"
            className="PeopleGridLoadMore"
            onClick={() => setVisibleCount((current) => current + CHUNK_SIZE)}
          >
            Load more ({people.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </>
  );
}
