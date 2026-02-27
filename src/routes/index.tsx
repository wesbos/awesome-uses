import { createFileRoute } from '@tanstack/react-router';
import BackToTop from '../components/BackToTop';
import DirectoryFiltersForm from '../components/DirectoryFiltersForm';
import PeopleGrid from '../components/PeopleGrid';
import TopicLinks from '../components/TopicLinks';
import { parseDirectorySearch } from '../lib/filters';
import { getDirectoryData } from '../lib/data';

export const Route = createFileRoute('/')({
  validateSearch: parseDirectorySearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => {
    return getDirectoryData(deps);
  },
  component: IndexPage,
});

function IndexPage() {
  const data = Route.useLoaderData();
  const tagSlugByName = data.tags.reduce<Record<string, string>>((acc, tag) => {
    acc[tag.name] = tag.slug;
    return acc;
  }, {});

  return (
    <>
      <DirectoryFiltersForm
        filters={data.filters}
        tags={data.tags}
        countries={data.countries}
        devices={data.devices}
      />

      <TopicLinks
        tags={data.tags}
        countries={data.countries}
        devices={data.devices}
        currentFilters={data.filters}
      />

      <p>
        Showing <strong>{data.people.length}</strong> of{' '}
        <strong>{data.totalPeople}</strong> people.
      </p>

      <PeopleGrid
        people={data.people}
        activeTagName={
          data.filters.tag
            ? data.tags.find((tag) => tag.slug === data.filters.tag)?.name
            : undefined
        }
        tagSlugByName={tagSlugByName}
      />
      <BackToTop />
    </>
  );
}
