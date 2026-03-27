import { createFileRoute } from '@tanstack/react-router';
import DirectoryLayout from '../components/DirectoryLayout';
import { getDirectoryData } from '../lib/data';
import { $getErrorSlugs } from '../server/fn/profiles';
import { $getFeaturedItems, $getPopularLanguages } from '../server/fn/items';
import { $getAwards } from '../server/fn/awards';
import { buildMeta, SITE_URL } from '../lib/seo';

export const Route = createFileRoute('/')({
  head: ({ loaderData }) => {
    const desc = `A directory of ${loaderData?.totalPeople ?? ''} developer /uses pages detailing setups, gear, software and configs.`;
    return buildMeta({
      title: '/uses — Developer Setups Directory',
      description: desc,
      canonical: SITE_URL,
    });
  },
  loader: async () => {
    const [directoryData, errorSlugs, featured, languages, awards] = await Promise.all([
      getDirectoryData({}),
      $getErrorSlugs().catch(() => [] as string[]),
      $getFeaturedItems().catch(() => ({ product: [], software: [], service: [] })),
      $getPopularLanguages().catch(() => []),
      $getAwards().catch(() => []),
    ]);
    return { ...directoryData, awards, errorSlugs: new Set(errorSlugs), featured, languages };
  },
  component: IndexPage,
});

function IndexPage() {
  const data = Route.useLoaderData();
  const visiblePeople = data.people.filter((p) => !data.errorSlugs.has(p.personSlug));

  return (
    <DirectoryLayout
      people={visiblePeople}
      totalPeople={data.totalPeople}
      tags={[]}
      countries={data.countries}
      devices={[]}
      featured={data.featured}
      languages={data.languages}
      awards={data.awards}
    />
  );
}
