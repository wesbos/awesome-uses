import type { AnyAward, AwardDataMap, AwardKey } from '../server/awards/types';
import { MostPopularLanguageAward } from './awards/MostPopularLanguageAward';
import { DomainLengthAward } from './awards/DomainLengthAward';
import { MostGithubFollowersAward } from './awards/MostGithubFollowersAward';
import { TldAward } from './awards/TldAward';
import { MostPopularTagAward } from './awards/MostPopularTagAward';
import { NameLengthAward } from './awards/NameLengthAward';
import { MostPopularProductAward } from './awards/MostPopularProductAward';
import { PeopleSimilarityAward } from './awards/PeopleSimilarityAward';
import { MostGithubContributionsAward } from './awards/MostGithubContributionsAward';
import { MostGithubStarsAward } from './awards/MostGithubStarsAward';

type AwardsProps = {
  awards: AnyAward[];
};

const AWARD_RENDERERS: Record<AwardKey, (data: never) => React.ReactNode> = {
  'most-popular-language': (data) => <MostPopularLanguageAward data={data} />,
  'longest-domain': (data) => <DomainLengthAward data={data} />,
  'shortest-domain': (data) => <DomainLengthAward data={data} />,
  'most-github-followers': (data) => <MostGithubFollowersAward data={data} />,
  'most-common-tld': (data) => <TldAward data={data} />,
  'rarest-tld': (data) => <TldAward data={data} />,
  'most-popular-tag': (data) => <MostPopularTagAward data={data} />,
  'longest-name': (data) => <NameLengthAward data={data} />,
  'shortest-name': (data) => <NameLengthAward data={data} />,
  'most-popular-product': (data) => <MostPopularProductAward data={data} />,
  'most-similar-people': (data) => <PeopleSimilarityAward data={data} />,
  'most-opposite-people': (data) => <PeopleSimilarityAward data={data} />,
  'most-github-contributions': (data) => <MostGithubContributionsAward data={data} />,
  'most-github-stars': (data) => <MostGithubStarsAward data={data} />,
};

function AwardCard({ award }: { award: AnyAward }) {
  const render = AWARD_RENDERERS[award.awardKey as AwardKey];
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {award.title}
      </dt>
      <dd className="mt-1">
        {render
          ? render(award.data as never)
          : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

export default function Awards({ awards }: AwardsProps) {
  if (awards.length === 0) return null;

  return (
    <details className="group rounded-[4px] [corner-shape:bevel] border border-border bg-card p-4 text-sm" open>
      <summary className="cursor-pointer select-none font-semibold text-foreground">
        Awards
      </summary>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {awards.map((award) => (
          <AwardCard key={award.awardKey} award={award} />
        ))}
      </dl>
    </details>
  );
}
