import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { buildMeta, SITE_URL } from '../lib/seo';

export const Route = createFileRoute('/add')({
  head: () =>
    buildMeta({
      title: 'Add Your /uses Page',
      description:
        'Submit your developer /uses page to the directory. Document your setup and get listed alongside thousands of developers.',
      canonical: `${SITE_URL}/add`,
    }),
  component: AddPage,
});

const EXAMPLE_ENTRY = `{
  name: 'Your Name',
  description: 'Frontend Developer, Cat Enthusiast',
  url: 'https://yoursite.com/uses',
  country: '🇺🇸',
  computer: 'apple',
  phone: 'iphone',
  twitter: '@yourhandle',
  github: 'yourgithub',
  tags: ['JavaScript', 'TypeScript', 'React', 'VS Code', 'Figma'],
},`;

const CONTENT_IDEAS = [
  { heading: 'Hardware', examples: 'Laptop, monitor, keyboard, mouse, desk, chair, microphone, webcam, headphones' },
  { heading: 'Development', examples: 'Editor, terminal, font, theme, browser, extensions, CLI tools' },
  { heading: 'Software', examples: 'Design tools, productivity apps, note-taking, music, communication' },
  { heading: 'Desk Setup', examples: 'Standing desk, lighting, cable management, accessories, decorations' },
  { heading: 'Hosting & Services', examples: 'Hosting provider, domain registrar, CI/CD, monitoring, analytics' },
];

const VALID_COMPUTERS = ['apple', 'windows', 'linux', 'bsd'] as const;
const VALID_PHONES = ['iphone', 'android', 'windowsphone', 'flipphone'] as const;

function StepNumber({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
      {n}
    </span>
  );
}

function AddPage() {
  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to directory
        </Link>
      </div>

      <div className="space-y-3">
        <h2 className="text-3xl font-bold tracking-tight">Add Your /uses Page</h2>
        <p className="text-muted-foreground text-lg">
          Got a <code className="bg-muted px-1.5 py-0.5 rounded text-sm">/uses</code> page?
          Get listed in the directory by submitting a pull request.
        </p>
      </div>

      {/* Step 1 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <StepNumber n={1} />
          <h3 className="text-xl font-semibold">Create your /uses page</h3>
        </div>
        <p className="text-muted-foreground ml-11">
          Publish a page at <code className="bg-muted px-1.5 py-0.5 rounded text-sm">/uses</code> on
          your personal website. It should detail the tools, software, hardware, and
          configurations you use for your work.
        </p>

        <Card className="ml-11">
          <CardContent className="pt-6">
            <p className="text-sm font-medium mb-3">Not sure what to include? Here are some ideas:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {CONTENT_IDEAS.map(({ heading, examples }) => (
                <div key={heading}>
                  <p className="text-sm font-medium">{heading}</p>
                  <p className="text-xs text-muted-foreground">{examples}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground ml-11">
          Check out the{' '}
          <Link to="/" className="underline hover:text-foreground transition-colors">
            existing entries
          </Link>{' '}
          for inspiration.
        </p>
      </section>

      {/* Step 2 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <StepNumber n={2} />
          <h3 className="text-xl font-semibold">Add your entry to the data file</h3>
        </div>
        <div className="ml-11 space-y-3">
          <p className="text-muted-foreground">
            Fork the{' '}
            <a
              href="https://github.com/wesbos/awesome-uses"
              className="underline hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              awesome-uses
            </a>{' '}
            repo and add your entry to{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm">src/data.js</code>.
            Add yourself to the <strong>top</strong> of the array.
          </p>

          <div className="rounded-lg border bg-muted/50 p-4 overflow-x-auto">
            <pre className="text-sm"><code>{EXAMPLE_ENTRY}</code></pre>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium">Field reference:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Field</th>
                    <th className="pb-2 pr-4 font-medium">Required</th>
                    <th className="pb-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code className="text-foreground text-xs">name</code></td>
                    <td className="py-2 pr-4">Yes</td>
                    <td className="py-2">Your name</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code className="text-foreground text-xs">description</code></td>
                    <td className="py-2 pr-4">Yes</td>
                    <td className="py-2">Short tagline about yourself</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code className="text-foreground text-xs">url</code></td>
                    <td className="py-2 pr-4">Yes</td>
                    <td className="py-2">Full URL to your /uses page</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code className="text-foreground text-xs">country</code></td>
                    <td className="py-2 pr-4">Yes</td>
                    <td className="py-2">Flag emoji for your country</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code className="text-foreground text-xs">tags</code></td>
                    <td className="py-2 pr-4">Yes</td>
                    <td className="py-2">Array of tools/technologies you use</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code className="text-foreground text-xs">computer</code></td>
                    <td className="py-2 pr-4">No</td>
                    <td className="py-2">
                      {VALID_COMPUTERS.map((v, i) => (
                        <span key={v}>
                          <code className="text-xs">{v}</code>
                          {i < VALID_COMPUTERS.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code className="text-foreground text-xs">phone</code></td>
                    <td className="py-2 pr-4">No</td>
                    <td className="py-2">
                      {VALID_PHONES.map((v, i) => (
                        <span key={v}>
                          <code className="text-xs">{v}</code>
                          {i < VALID_PHONES.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code className="text-foreground text-xs">github</code></td>
                    <td className="py-2 pr-4">No</td>
                    <td className="py-2">GitHub username (without @)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code className="text-foreground text-xs">twitter</code></td>
                    <td className="py-2 pr-4">No</td>
                    <td className="py-2">Twitter handle (with @)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code className="text-foreground text-xs">mastodon</code></td>
                    <td className="py-2 pr-4">No</td>
                    <td className="py-2">Full Mastodon handle (e.g. @user@instance.social)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code className="text-foreground text-xs">bluesky</code></td>
                    <td className="py-2 pr-4">No</td>
                    <td className="py-2">Bluesky handle (without @)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4"><code className="text-foreground text-xs">emoji</code></td>
                    <td className="py-2 pr-4">No</td>
                    <td className="py-2">An emoji that represents you</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Step 3 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <StepNumber n={3} />
          <h3 className="text-xl font-semibold">Submit a pull request</h3>
        </div>
        <div className="ml-11 space-y-3">
          <p className="text-muted-foreground">
            Commit your changes and open a pull request against the{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm">master</code> branch.
            A maintainer will review and merge it.
          </p>
          <a
            href="https://github.com/wesbos/awesome-uses/edit/master/src/data.js"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6 text-sm font-medium transition-colors"
          >
            Edit data.js on GitHub
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
          </a>
        </div>
      </section>

      {/* Guidelines */}
      <section className="space-y-4 border-t pt-8">
        <h3 className="text-lg font-semibold">Guidelines</h3>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground text-sm">
          <li>Your <code className="bg-muted px-1 py-0.5 rounded text-xs">/uses</code> page must be publicly accessible</li>
          <li>The URL should point directly to your /uses page, not your homepage</li>
          <li>Use existing tag names where possible &mdash; check the{' '}
            <Link to="/tags" className="underline hover:text-foreground transition-colors">tags page</Link>{' '}
            for common ones</li>
          <li>One entry per person &mdash; update your existing entry if your setup changes</li>
          <li>Keep your description concise (a short tagline, not a bio)</li>
        </ul>
      </section>
    </div>
  );
}
