export type PersonRef = {
  personSlug: string;
  name: string;
};

export type AwardDataMap = {
  'most-popular-language': {
    language: string;
    color: string;
    devCount: number;
    runnersUp: { language: string; color: string; devCount: number }[];
  };
  'longest-domain': {
    domain: string;
    length: number;
    person: PersonRef;
  };
  'shortest-domain': {
    domain: string;
    length: number;
    person: PersonRef;
  };
  'most-github-followers': {
    person: PersonRef & { github: string };
    followers: number;
    runnersUp: (PersonRef & { github: string; followers: number })[];
  };
  'most-common-tld': {
    tld: string;
    count: number;
    runnersUp: { tld: string; count: number }[];
  };
  'rarest-tld': {
    tld: string;
    count: number;
    runnersUp: { tld: string; count: number }[];
  };
  'most-popular-tag': {
    tag: string;
    count: number;
    runnersUp: { tag: string; count: number }[];
  };
  'longest-name': {
    person: PersonRef;
    length: number;
  };
  'shortest-name': {
    person: PersonRef;
    length: number;
  };
  'most-popular-product': {
    item: string;
    itemSlug: string;
    count: number;
    runnersUp: { item: string; itemSlug: string; count: number }[];
  };
  'most-similar-people': {
    personA: PersonRef;
    personB: PersonRef;
    score: number;
    runnersUp: { personA: PersonRef; personB: PersonRef; score: number }[];
  };
  'most-opposite-people': {
    personA: PersonRef;
    personB: PersonRef;
    score: number;
    runnersUp: { personA: PersonRef; personB: PersonRef; score: number }[];
  };
  'most-github-contributions': {
    contributors: {
      person: PersonRef & { github: string };
      contributions: number;
    }[];
  };
  'most-github-stars': {
    repos: {
      repoName: string;
      repoUrl: string;
      stars: number;
      person: PersonRef & { github: string };
    }[];
  };
};

export type AwardKey = keyof AwardDataMap;

export type Award<K extends AwardKey = AwardKey> = K extends AwardKey
  ? {
      awardKey: K;
      title: string;
      description: string | null;
      data: AwardDataMap[K];
      calculatedAt: string;
    }
  : never;

export type AnyAward = Award<AwardKey>;
