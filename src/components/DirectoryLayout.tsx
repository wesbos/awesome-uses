import BackToTop from './BackToTop';
import PeopleGrid from './PeopleGrid';
import TopicLinks from './TopicLinks';
import { FeaturedItems } from './FeaturedItems';
import Facts from './Facts';
import type { Person, TagSummary, CountrySummary, DeviceSummary } from '../lib/types';
import type { DirectoryFacts } from '../lib/types';
import type { FeaturedItemsByType, PopularLanguage } from '../server/fn/items';

type DirectoryLayoutProps = {
  people: Person[];
  totalPeople: number;
  tags: TagSummary[];
  countries: CountrySummary[];
  devices: DeviceSummary[];
  currentTag?: string;
  activeTagName?: string;
  featured?: FeaturedItemsByType;
  languages?: PopularLanguage[];
  facts?: DirectoryFacts;
};

export default function DirectoryLayout({
  people,
  totalPeople,
  tags,
  countries,
  devices,
  currentTag,
  activeTagName,
  featured,
  languages,
  facts,
}: DirectoryLayoutProps) {
  return (
    <div className="space-y-6">
      <TopicLinks
        tags={tags}
        countries={countries}
        devices={devices}
        currentTag={currentTag}
      />

      <p className="text-sm text-muted-foreground">
        Showing <strong className="text-foreground">{people.length}</strong>
        {totalPeople !== people.length && (
          <> of <strong className="text-foreground">{totalPeople}</strong></>
        )} people.
      </p>

      {featured && <FeaturedItems featured={featured} languages={languages} />}

      {facts && <Facts facts={facts} />}

      <PeopleGrid people={people} activeTagName={activeTagName} />
      <BackToTop />
    </div>
  );
}
