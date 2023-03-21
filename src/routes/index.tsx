import { ShouldRevalidateFunction, useLoaderData, useSearchParams } from '@remix-run/react';
import Topics from '../components/Topics';
import BackToTop from '../components/BackToTop';
import Person from '../components/Person';
import { getPeople } from 'src/util/stats';

export async function loader() {
  const people = getPeople();
  return { people };
}

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) => {
  return Boolean(currentUrl.pathname !== nextUrl.pathname);
};

export default function Index() {
  const { people } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const tag = searchParams.get('like');
  const filteredPeople = people
    .filter((person) => {
      if (!tag) {
        return true;
      }
      return (
        person.tags.includes(tag) ||
        person.country === tag ||
        person.phone === tag ||
        person.computer === tag
      );
    })
    .sort(() => Math.random() - 0.5);

  return (
    <>
      <Topics />
      <div className="People">
        {filteredPeople.map((person) => (
          <Person key={person.name} person={person} />
        ))}
      </div>
      <BackToTop />
    </>
  );
}
