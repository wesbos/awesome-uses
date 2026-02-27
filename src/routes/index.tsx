import { createFileRoute } from '@tanstack/react-router';
import BackToTop from '../components/BackToTop';
import PeopleGrid from '../components/PeopleGrid';
import TopicLinks from '../components/TopicLinks';
import { getDirectoryData } from '../lib/data';

export const Route = createFileRoute('/')({
  loader: () => {
    return getDirectoryData({});
  },
  component: IndexPage,
});

function IndexPage() {
  const data = Route.useLoaderData();

  return (
    <>
      <TopicLinks
        tags={data.tags}
        countries={data.countries}
        devices={data.devices}
        currentTag={undefined}
      />

      <p>
        Showing <strong>{data.people.length}</strong> of{' '}
        <strong>{data.totalPeople}</strong> people.
      </p>

      <PeopleGrid
        people={data.people}
        activeTagName={undefined}
      />
      <BackToTop />
    </>
  );
}
