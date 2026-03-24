import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import AnimatedFavicon from '../components/AnimatedFavicon';
import Header from '../components/Header';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { ThemeProvider } from '../components/theme-provider';
import { DEFAULT_DESCRIPTION, SITE_URL, ogImageUrl } from '../lib/seo';

import appCss from '../styles.css?url';

const ShaderBackground = lazy(() => import('../components/ShaderBackground'));

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
        <ThemeProvider defaultTheme="dark">
          <Suspense>
            <ShaderBackground />
          </Suspense>
          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <AnimatedFavicon />
            <Header />
            <Nav />
            <Outlet />
            <Footer />
          </div>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
