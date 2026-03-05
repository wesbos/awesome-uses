import { createFileRoute } from '@tanstack/react-router';
import BackToTop from '../../components/BackToTop';
import PeopleGrid from '../../components/PeopleGrid';
import TopicLinks from '../../components/TopicLinks';
import {
  getAllCountries,
  getAllDevices,
  getAllTags,
  getPeopleForLikeTag,
} from '../../lib/data';

export const Route = createFileRoute('/like/$tag')({
  loader: ({ params }) => {
    const { people, rawTag, activeTagName } = getPeopleForLikeTag(params.tag);
    return {
      people,
      totalPeople: people.length,
      rawTag,
      activeTagName,
      tags: getAllTags(),
      countries: getAllCountries(),
      devices: getAllDevices(),
    };
  },
  component: LikeTagPage,
});

function LikeTagPage() {
  const data = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <TopicLinks
        tags={data.tags}
        countries={data.countries}
        devices={data.devices}
        currentTag={data.rawTag}
      />

      <p className="text-sm text-muted-foreground">
        Showing <strong className="text-foreground">{data.people.length}</strong> people.
      </p>

      <PeopleGrid people={data.people} activeTagName={data.activeTagName} />
      <BackToTop />
    </div>
  );
}
