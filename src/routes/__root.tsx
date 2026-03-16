import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AnimatedFavicon from '../components/AnimatedFavicon';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { ThemeProvider } from '../components/theme-provider';
import { DEFAULT_DESCRIPTION, SITE_URL, ogImageUrl } from '../lib/seo';
import ShaderBackground from '../components/ShaderBackground';

import appCss from '../styles.css?url';

const queryClient = new QueryClient();

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: '/uses' },
      { name: 'description', content: DEFAULT_DESCRIPTION },
      { property: 'og:title', content: '/uses' },
      { property: 'og:description', content: DEFAULT_DESCRIPTION },
      { property: 'og:image', content: ogImageUrl({ title: '/uses', subtitle: DEFAULT_DESCRIPTION }) },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: '/uses' },
      { property: 'og:url', content: SITE_URL },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: '/uses' },
      { name: 'twitter:description', content: DEFAULT_DESCRIPTION },
      { name: 'twitter:image', content: ogImageUrl({ title: '/uses', subtitle: DEFAULT_DESCRIPTION }) },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Unbounded:wght@400;600;700;900&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: 'https://fav.farm/🖥' },
      { rel: 'canonical', href: SITE_URL },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <section className="py-20 text-center">
      <h2 className="text-4xl font-bold">404</h2>
      <p className="mt-4 text-muted-foreground">
        Nothing here — try the <a href="/" className="underline">homepage</a>.
      </p>
    </section>
  ),
});

function RootDocument() {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="dark">
            <ShaderBackground />
            <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
              <AnimatedFavicon />
              <Nav />
              <Outlet />
              <Footer />
            </div>
          </ThemeProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
