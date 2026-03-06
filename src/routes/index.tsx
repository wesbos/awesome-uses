import { Link, createFileRoute } from '@tanstack/react-router';
import BackToTop from '../components/BackToTop';
import Facts from '../components/Facts';
import PeopleGrid from '../components/PeopleGrid';
import TopicLinks from '../components/TopicLinks';
import { getDirectoryData, getDirectoryFacts } from '../lib/data';
import { $getErrorSlugs } from '../server/fn/profiles';
import { buildMeta, SITE_URL } from '../lib/seo';
import { Button } from '../components/ui/button';

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
    const [directoryData, errorSlugs] = await Promise.all([
      getDirectoryData({}),
      $getErrorSlugs().catch(() => [] as string[]),
    ]);
    const facts = getDirectoryFacts();
    return { ...directoryData, facts, errorSlugs: new Set(errorSlugs) };
  },
  component: IndexPage,
});

function IndexPage() {
  const data = Route.useLoaderData();
  const visiblePeople = data.people.filter((p) => !data.errorSlugs.has(p.personSlug));

  return (
    <div className="space-y-6">
      <section className="py-8 sm:py-12 text-center space-y-4">
        <h2 className="text-5xl sm:text-6xl font-bold tracking-tighter">/uses</h2>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
          A list of{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-sm text-foreground">/uses</code>{' '}
          pages detailing developer setups, gear, software and configs.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{data.totalPeople}</strong> developers and counting
          </p>
          <span className="text-border">|</span>
          <Button asChild size="sm">
            <Link to="/add">Add yours</Link>
          </Button>
        </div>
      </section>

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

      <Facts facts={data.facts} />

      <PeopleGrid people={visiblePeople} activeTagName={undefined} />
      <BackToTop />
    </div>
  );
}
