const SITE_NAME = '/uses';
const SITE_URL = 'https://uses.tech';
const DEFAULT_DESCRIPTION =
  'A list of /uses pages detailing developer setups, gear, software and configs.';

type OgImageParams = {
  title: string;
  subtitle?: string;
};

export function ogImageUrl({ title, subtitle }: OgImageParams): string {
  const params = new URLSearchParams({ title });
  if (subtitle) params.set('subtitle', subtitle);
  return `${SITE_URL}/og?${params.toString()}`;
}

type SeoMeta = {
  title: string;
  description: string;
  ogImage?: string;
  canonical?: string;
  type?: string;
};

export function buildMeta({
  title,
  description,
  ogImage,
  canonical,
  type = 'website',
}: SeoMeta) {
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const image = ogImage || ogImageUrl({ title });

  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: description },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: description },
      { property: 'og:image', content: image },
      { property: 'og:type', content: type },
      { property: 'og:site_name', content: SITE_NAME },
      ...(canonical ? [{ property: 'og:url', content: canonical }] : []),
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
    ],
    links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
  };
}

export { SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION };
