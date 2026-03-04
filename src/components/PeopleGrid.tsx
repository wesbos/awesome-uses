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
      <style>{/*css*/`
        @scope (.People) {
          :scope {
            display: grid;
            border-right: .5px solid var(--vape);
            border-bottom: .5px solid var(--vape);
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            grid-gap: 0;
            @media all and (max-width: 400px) {
              grid-template-columns: 1fr;
            }
          }
        }
      `}</style>
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
