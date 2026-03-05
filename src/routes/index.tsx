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
    <div className="space-y-6">
      <TopicLinks
        tags={data.tags}
        countries={data.countries}
        devices={data.devices}
        currentTag={undefined}
      />

      <p className="text-sm text-muted-foreground">
        Showing <strong className="text-foreground">{data.people.length}</strong> of{' '}
        <strong className="text-foreground">{data.totalPeople}</strong> people.
      </p>

      <PeopleGrid people={data.people} activeTagName={undefined} />
      <BackToTop />
    </div>
  );
}
