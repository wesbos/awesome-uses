import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import DirectoryLayout from '../../components/DirectoryLayout';
import {
  getAllCountries,
  getPeopleForLikeTag,
} from '../../lib/data';
import { $trackView } from '../../server/fn/admin';
import { buildMeta, SITE_URL, ogImageUrl } from '../../lib/seo';

export const Route = createFileRoute('/like/$tag')({
  head: ({ params }: { params: { tag: string } }) => {
    const tag = params.tag;
    return buildMeta({
      title: `Developers using ${tag}`,
      description: `Developers who use ${tag} in their setup.`,
      ogImage: ogImageUrl({ title: tag, subtitle: 'Developers' }),
      canonical: `${SITE_URL}/like/${encodeURIComponent(tag)}`,
    });
  },
  loader: ({ params }: { params: { tag: string } }) => {
    const { people, rawTag, activeTagName } = getPeopleForLikeTag(params.tag);
    return {
      people,
      totalPeople: people.length,
      rawTag,
      activeTagName,
      countries: getAllCountries(),
    };
  },
  component: LikeTagPage,
} as any);

function LikeTagPage() {
  const data = Route.useLoaderData() as {
    people: ReturnType<typeof getPeopleForLikeTag>['people'];
    totalPeople: number;
    rawTag: string;
    activeTagName: string | undefined;
    countries: ReturnType<typeof getAllCountries>;
  };

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
    <DirectoryLayout
      people={data.people}
      totalPeople={data.totalPeople}
      tags={[]}
      countries={data.countries}
      devices={[]}
      currentTag={data.rawTag}
      activeTagName={data.activeTagName}
    />
  );
}
