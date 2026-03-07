import { Link } from '@tanstack/react-router';
import type { DirectoryFacts } from '../lib/types';

type FactsProps = {
  facts: DirectoryFacts;
};

function PersonLink({ name, slug }: { name: string; slug: string }) {
  return (
    <Link
      to="/people/$personSlug"
      params={{ personSlug: slug }}
      className="font-semibold text-foreground hover:underline"
    >
      {name}
    </Link>
  );
}

function Stat({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-semibold text-(--yellow)">{children}</span>
  );
}

export default function Facts({ facts }: FactsProps) {
  return (
    <details className="group rounded-[4px] [corner-shape:bevel] border border-border bg-card p-4 text-sm">
      <summary className="cursor-pointer select-none font-semibold text-foreground">
        Fun Facts
      </summary>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Shortest Name
          </dt>
          <dd className="mt-1">
            <PersonLink name={facts.shortestName.name} slug={facts.shortestName.personSlug} />
            <span className="text-muted-foreground"> ({facts.shortestName.name.trim().length} chars)</span>
          </dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Longest Name
          </dt>
          <dd className="mt-1">
            <PersonLink name={facts.longestName.name} slug={facts.longestName.personSlug} />
            <span className="text-muted-foreground"> ({facts.longestName.name.trim().length} chars)</span>
          </dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Shortest Domain
          </dt>
          <dd className="mt-1">
            <Stat>{facts.shortestDomain.domain}</Stat>
            <span className="text-muted-foreground">
              {' '}— <PersonLink name={facts.shortestDomain.name} slug={facts.shortestDomain.personSlug} />
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Longest Domain
          </dt>
          <dd className="mt-1">
            <Stat>{facts.longestDomain.domain}</Stat>
            <span className="text-muted-foreground">
              {' '}— <PersonLink name={facts.longestDomain.name} slug={facts.longestDomain.personSlug} />
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Most Common TLDs
          </dt>
          <dd className="mt-1 space-y-0.5">
            {facts.topTlds.map((t) => (
              <div key={t.tld} className="flex justify-between max-w-48">
                <Stat>{t.tld}</Stat>
                <span className="text-muted-foreground">{t.count}</span>
              </div>
            ))}
          </dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Rarest TLDs
          </dt>
          <dd className="mt-1 space-y-0.5">
            {facts.bottomTlds.map((t) => (
              <div key={t.tld} className="flex justify-between max-w-48">
                <Stat>{t.tld}</Stat>
                <span className="text-muted-foreground">{t.count}</span>
              </div>
            ))}
          </dd>
        </div>

        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Most Popular Tags
          </dt>
          <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {facts.topTags.map((t) => (
              <Link key={t.name} to="/like/$tag" params={{ tag: t.name }} className="hover:underline">
                <Stat>{t.name}</Stat>
                <span className="text-muted-foreground"> ({t.count})</span>
              </Link>
            ))}
          </dd>
        </div>
      </dl>
    </details>
  );
}
