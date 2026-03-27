import { Link, createFileRoute, notFound } from '@tanstack/react-router';
import { useEffect } from 'react';
import { name as countryName } from 'country-emoji';
import { getPersonBySlug } from '../lib/data';
import { getAvatarUrl } from '../lib/avatar';
import { extractCompaniesFromText } from '../lib/company-logos';
import type { PersonItem, ScrapedProfileData } from '../lib/types';
import { $getScrapedProfile, $getPersonItems, $getGitHubStats } from '../server/fn/profiles';
import type { GitHubStats } from '../server/github';
import { GitHubStatsCard } from '../components/GitHubStatsCard';
import { $getSimilarPeople, type SimilarPerson, type VectorizeDebug } from '../server/fn/vectorize';
import { $trackView } from '../server/fn/admin';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/Avatar';
import { SocialLinks } from '@/components/SocialLinks';
import { UsesUrl } from '@/components/UsesUrl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemIcon } from '@/components/ItemIcon';
import { PersonMiniCard } from '@/components/PersonMiniCard';
import { buildMeta, SITE_URL, ogImageUrl } from '../lib/seo';
import { AvatarDebug } from '@/components/AvatarDebug';

export const Route = createFileRoute('/people/$personSlug')({
  head: ({ params }: { params: { personSlug: string } }) => {
    const name = params.personSlug.replace(/-/g, ' ');
    const desc = `${name}'s developer setup and tools.`;
    return buildMeta({
      title: `${name}'s /uses`,
      description: desc,
      ogImage: ogImageUrl({ title: name, subtitle: desc }),
      canonical: `${SITE_URL}/people/${params.personSlug}`,
      type: 'profile',
    });
  },
  loader: async ({ params }: { params: { personSlug: string } }) => {
    const person = getPersonBySlug(params.personSlug);
    if (!person) {
      throw notFound();
    }
    const defaultSimilarResult = {
      similar: [] as SimilarPerson[],
      debug: { hasBinding: false, personSlug: person.personSlug, rawJson: '{}', error: 'catch' } as VectorizeDebug,
    };
    const [scrapeResult, items, similarResult, githubStats] = await Promise.all([
      $getScrapedProfile({ data: person.personSlug }).catch(() => null),
      $getPersonItems({ data: person.personSlug }).catch(() => [] as PersonItem[]),
      $getSimilarPeople({ data: person.personSlug }).catch(() => defaultSimilarResult),
      $getGitHubStats({ data: person.personSlug }).catch((e) => { console.error('[github] fetch failed', e); return null; }),
    ]);
    return {
      person,
      scraped: scrapeResult?.data ?? null,
      items,
      similarPeople: similarResult.similar,
      vectorizeDebug: similarResult.debug,
      githubStats,
    };
  },
  component: PersonPage,
} as any);

function PersonPage() {
  const { person, scraped, items, similarPeople, vectorizeDebug, githubStats } = Route.useLoaderData() as {
    person: NonNullable<ReturnType<typeof getPersonBySlug>>;
    scraped: ScrapedProfileData | null;
    items: PersonItem[];
    similarPeople: SimilarPerson[];
    vectorizeDebug: VectorizeDebug;
    githubStats: GitHubStats | null;
  };
  const companies = extractCompaniesFromText(person.description);
  const avatarUrl = getAvatarUrl(person, githubStats?.socialAccounts);
  const country = countryName(person.country);

  useEffect(() => {
    void $trackView({
      data: {
        entityType: 'person',
        entityKey: person.personSlug,
        route: `/people/${person.personSlug}`,
      },
    });
  }, [person.personSlug]);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to directory
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <Avatar src={avatarUrl} alt={person.name} size="lg" personSlug={person.personSlug} />
            <img
              src={avatarUrl}
              alt={`${person.name} original`}
              className="h-20 w-20 shrink-0 object-cover border border-border"
              loading="lazy"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <CardTitle className="text-lg">
                {person.name} {person.emoji}
              </CardTitle>

              {country && (
                <p className="text-sm text-muted-foreground">
                  {person.country} {country}
                </p>
              )}

              <UsesUrl
                url={person.url}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              />

              <SocialLinks
                person={person}
                className="text-sm text-muted-foreground"
              />
            </div>
          </div>

          {person.description && (
            <p className="text-sm text-muted-foreground mt-3">{person.description}</p>
          )}

          {companies.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {companies.map((company) => (
                <span
                  key={company.key}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
                >
                  <img
                    src={company.logoUrl}
                    alt={company.name}
                    loading="lazy"
                    className="h-3.5 w-3.5"
                  />
                  {company.name}
                </span>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {person.canonicalTags.slice(0, 10).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                <Link to="/like/$tag" params={{ tag }}>
                  {tag}
                </Link>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {githubStats && <GitHubStatsCard stats={githubStats} />}

      <AvatarDebug person={person} githubSocials={githubStats?.socialAccounts} />

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extracted Gear & Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemsList items={items} />
          </CardContent>
        </Card>
      )}

      {similarPeople.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Similar People</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {similarPeople.map((sp) => (
                <PersonMiniCard key={sp.personSlug} face={sp} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vectorize Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs font-mono whitespace-pre-wrap bg-muted rounded-md p-3 overflow-auto max-h-[40vh]">
{`hasBinding: ${vectorizeDebug.hasBinding}
personSlug: ${vectorizeDebug.personSlug}
error: ${vectorizeDebug.error ?? 'none'}

raw response:
${vectorizeDebug.rawJson}`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Scraped /uses snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!scraped && (
            <p className="text-sm text-muted-foreground">
              No scrape data is available yet. This page attempts an on-demand
              scrape when loaded.
            </p>
          )}
          {scraped && (
            <div className="space-y-3">
              <p className="text-sm">
                Last fetched:{' '}
                <strong>
                  {new Date(scraped.fetchedAt).toLocaleString()}
                </strong>
                {' · '}Status: {scraped.statusCode ?? 'unknown'}
              </p>
              {scraped.title && (
                <p className="text-sm">
                  Title: <strong>{scraped.title}</strong>
                </p>
              )}
              {scraped.contentMarkdown && (
                <textarea
                  readOnly
                  className="w-full h-[40vh] rounded-md border bg-muted p-3 text-xs font-mono resize-y"
                  defaultValue={scraped.contentMarkdown}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ItemsList({ items }: { items: PersonItem[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge
          key={item.itemSlug}
          variant="outline"
          className="text-xs"
          title={item.detail || undefined}
        >
          <Link to="/items/$itemSlug" params={{ itemSlug: item.itemSlug }} className="inline-flex items-center gap-1">
            <ItemIcon itemSlug={item.itemSlug} />
            <strong className="hover:underline">{item.item}</strong>
          </Link>
          {item.tags.length > 0 && (
            <span className="ml-1 text-muted-foreground">
              {item.tags.join(', ')}
            </span>
          )}
        </Badge>
      ))}
    </div>
  );
}
