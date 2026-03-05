import type { Person } from '../lib/types';
import PersonCard from './PersonCard';

type PeopleGridProps = {
  people: Person[];
  activeTagName?: string;
};

export default function PeopleGrid({ people, activeTagName }: PeopleGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-l">
      {people.slice(0, 20).map((person) => (
        <PersonCard
          key={person.personSlug}
          person={person}
          activeTagName={activeTagName}
        />
      ))}
    </div>
  );
}
