import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import AnimatedFavicon from '../components/AnimatedFavicon';
import Header from '../components/Header';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { ThemeProvider } from '../components/theme-provider';

import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: '/uses' },
      {
        name: 'description',
        content: 'A list of /uses pages detailing developer setups.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: 'https://fav.farm/🖥' },
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
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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
