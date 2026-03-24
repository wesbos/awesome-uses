import { Link, createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildMeta, SITE_URL } from '../lib/seo';

export const Route = createFileRoute('/uses')({
  head: () =>
    buildMeta({
      title: '/uses uses',
      description:
        'The tech stack behind the /uses directory — TanStack Start, Cloudflare Workers, D1, Drizzle, Tailwind, OpenAI, and more.',
      canonical: `${SITE_URL}/uses`,
    }),
  component: UsesPage,
});

type StackItem = {
  name: string;
  url: string;
  description: string;
  tags: string[];
};

const STACK: Record<string, StackItem[]> = {
  'Framework & Routing': [
    {
      name: 'TanStack Start',
      url: 'https://tanstack.com/start',
      description:
        'Full-stack React framework with server functions, SSR, and streaming. Powers the server-side rendering and data loading.',
      tags: ['react', 'ssr', 'full-stack'],
    },
    {
      name: 'TanStack Router',
      url: 'https://tanstack.com/router',
      description:
        'Type-safe file-based routing with built-in loaders, search params validation, and code splitting.',
      tags: ['routing', 'type-safe'],
    },
    {
      name: 'React 19',
      url: 'https://react.dev',
      description:
        'UI library. Using React 19 with server components support and the latest concurrent features.',
      tags: ['ui', 'components'],
    },
  ],
  'Hosting & Infrastructure': [
    {
      name: 'Cloudflare Workers',
      url: 'https://workers.cloudflare.com',
      description:
        'Edge runtime that serves the entire app. Zero cold starts, globally distributed.',
      tags: ['edge', 'serverless'],
    },
    {
      name: 'Cloudflare D1',
      url: 'https://developers.cloudflare.com/d1',
      description:
        'SQLite-based database at the edge. Stores scraped /uses pages, extracted items, and analytics events.',
      tags: ['database', 'sqlite', 'edge'],
    },
    {
      name: 'Cloudflare Vectorize',
      url: 'https://developers.cloudflare.com/vectorize',
      description:
        'Vector database for similarity search. Stores OpenAI embeddings of /uses page content to find developers with similar setups.',
      tags: ['vectors', 'similarity', 'edge'],
    },
    {
      name: 'Cloudflare Analytics Engine',
      url: 'https://developers.cloudflare.com/analytics/analytics-engine',
      description:
        'Lightweight event tracking for page views and item clicks without third-party scripts.',
      tags: ['analytics', 'privacy'],
    },
  ],
  'Data & ORM': [
    {
      name: 'Drizzle ORM',
      url: 'https://orm.drizzle.team',
      description:
        'Type-safe SQL ORM with zero overhead. Handles all D1 queries with full TypeScript inference.',
      tags: ['orm', 'type-safe', 'sql'],
    },
    {
      name: 'Zod',
      url: 'https://zod.dev',
      description: 'Schema validation for API inputs and data parsing.',
      tags: ['validation', 'type-safe'],
    },
  ],
  'Styling & UI': [
    {
      name: 'Tailwind CSS v4',
      url: 'https://tailwindcss.com',
      description:
        'Utility-first CSS framework. v4 with the new engine, CSS-first configuration, and zero-config content detection.',
      tags: ['css', 'utility-first'],
    },
    {
      name: 'shadcn/ui',
      url: 'https://ui.shadcn.com',
      description:
        'Accessible, composable component primitives built on Radix UI. Cards, badges, buttons, dropdowns, and more.',
      tags: ['components', 'radix', 'accessible'],
    },
    {
      name: 'Lucide React',
      url: 'https://lucide.dev',
      description: 'Icon library used throughout the UI.',
      tags: ['icons', 'svg'],
    },
  ],
  'Build & Dev': [
    {
      name: 'Vite 7',
      url: 'https://vite.dev',
      description:
        'Build tool and dev server. Lightning-fast HMR and optimized production builds via the Cloudflare Vite plugin.',
      tags: ['build', 'hmr', 'bundler'],
    },
    {
      name: 'TypeScript',
      url: 'https://www.typescriptlang.org',
      description:
        'Strict TypeScript across the entire codebase — routes, server functions, database schema, and scripts.',
      tags: ['type-safe', 'dx'],
    },
    {
      name: 'pnpm',
      url: 'https://pnpm.io',
      description:
        'Fast, disk-efficient package manager.',
      tags: ['package-manager'],
    },
  ],
  'AI & Extraction': [
    {
      name: 'OpenAI',
      url: 'https://platform.openai.com',
      description:
        'GPT models extract structured gear/tool data from scraped /uses pages — item names, categories, and tags.',
      tags: ['ai', 'extraction', 'llm'],
    },
    {
      name: 'Turndown',
      url: 'https://github.com/mixmark-io/turndown',
      description:
        'Converts scraped HTML into clean Markdown before sending to the LLM for extraction.',
      tags: ['html', 'markdown'],
    },
  ],
  Services: [
    {
      name: 'unavatar.io',
      url: 'https://unavatar.io',
      description:
        'Universal avatar service. Resolves profile pictures from Twitter/X, GitHub, Bluesky, and website favicons with automatic fallback chaining.',
      tags: ['avatars', 'api'],
    },
    {
      name: 'workers-og',
      url: 'https://github.com/kvnang/workers-og',
      description:
        'Generates dynamic Open Graph images on the edge for social sharing previews.',
      tags: ['og-images', 'social'],
    },
  ],
};

const CATEGORY_ORDER = [
  'Framework & Routing',
  'Hosting & Infrastructure',
  'Data & ORM',
  'Styling & UI',
  'Build & Dev',
  'AI & Extraction',
  'Services',
];

function UsesPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to directory
        </Link>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">/uses uses</h1>
        <p className="text-muted-foreground max-w-2xl">
          A /uses page for the /uses site itself. Here's every piece of
          technology that powers this directory of developer setups.
        </p>
      </div>

      <div className="grid gap-6">
        {CATEGORY_ORDER.map((category) => (
          <section key={category} className="space-y-3">
            <h2 className="text-lg font-semibold">{category}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STACK[category].map((item) => (
                <Card key={item.name} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {item.name}
                      </a>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Source Code</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This site is open source. Check out the repo at{' '}
            <a
              href="https://github.com/wesbos/awesome-uses"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              github.com/wesbos/awesome-uses
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
