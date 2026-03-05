import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import BackToTop from '../components/BackToTop';
import PeopleGrid from '../components/PeopleGrid';
import TopicLinks from '../components/TopicLinks';
import { getDirectoryData } from '../lib/data';
import { $getErrorSlugs } from '../server/functions';

export const Route = createFileRoute('/')({
  loader: () => {
    return getDirectoryData({});
  },
  component: IndexPage,
});

function IndexPage() {
  const data = Route.useLoaderData();
  const [errorSlugs, setErrorSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    $getErrorSlugs().then((slugs) => {
      if (!cancelled) setErrorSlugs(new Set(slugs));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const visiblePeople = data.people.filter((p) => !errorSlugs.has(p.personSlug));

  return (
    <div className="space-y-6">
      <TopicLinks
        tags={data.tags}
        countries={data.countries}
        devices={data.devices}
        currentTag={undefined}
      />

      <p className="text-sm text-muted-foreground">
        Showing <strong className="text-foreground">{visiblePeople.length}</strong> of{' '}
        <strong className="text-foreground">{data.totalPeople}</strong> people.
      </p>

      <PeopleGrid people={visiblePeople} activeTagName={undefined} />
      <BackToTop />
    </div>
  );
}
