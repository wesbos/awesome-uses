import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import BackToTop from '../../components/BackToTop';
import PeopleGrid from '../../components/PeopleGrid';
import TopicLinks from '../../components/TopicLinks';
import {
  getAllCountries,
  getAllDevices,
  getAllTags,
  getPeopleForLikeTag,
} from '../../lib/data';
import { $trackView } from '../../server/functions';

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

  useEffect(() => {
    const key = data.activeTagName || data.rawTag;
    if (!key) return;

    void $trackView({
      data: {
        entityType: 'tag',
        entityKey: key.toLowerCase(),
        route: `/like/${encodeURIComponent(data.rawTag)}`,
      },
    });
  }, [data.activeTagName, data.rawTag]);

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
