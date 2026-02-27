import type { Person } from '../lib/types';
import PersonCard from './PersonCard';

type PeopleGridProps = {
  people: Person[];
  activeTagName?: string;
};

export default function PeopleGrid({
  people,
  activeTagName,
}: PeopleGridProps) {
  return (
    <div className="People">
      {people.map((person) => (
        <PersonCard
          key={person.personSlug}
          person={person}
          activeTagName={activeTagName}
        />
      ))}
    </div>
  );
}
