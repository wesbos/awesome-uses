import { useLoaderData, useParams } from '@remix-run/react';
import { json, LoaderArgs } from '@remix-run/server-runtime';
import React, { useContext } from 'react';
import Topics from '../components/Topics';
import BackToTop from '../components/BackToTop';
import Person from '../components/Person';
import { getPeople } from 'src/util/stats';

export async function loader({ params }: LoaderArgs) {
  const people = getPeople(params.tag);
  return {people};
}

export default function Index() {
  const { people } = useLoaderData();
  return (
    <>
      <Topics />
      <div className="People">
        {people.map(person => (
          <Person key={person.name} person={person} />
        ))}
      </div>
      <BackToTop />
    </>
  );
}
