import type { Person } from '../lib/types';
import PersonCard from './PersonCard';

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
  return (
    <div className="People">
      {people.map((person) => (
        <PersonCard
          key={person.personSlug}
          person={person}
          activeTagName={activeTagName}
          tagSlugByName={tagSlugByName}
        />
      ))}
    </div>
  );
}
