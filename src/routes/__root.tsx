import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import Header from '../components/Header';
import Footer from '../components/Footer';

import appCss from '../styles.css?url';
import normalizeCss from 'normalize.css?url';

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
      { rel: 'stylesheet', href: normalizeCss },
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: 'https://fav.farm/🖥' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <section>
      <h2>404</h2>
      <p>Nothing here — try the <a href="/">homepage</a>.</p>
    </section>
  ),
});

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <main className="Main">
          <Header />
          <Outlet />
          <Footer />
        </main>
        <Scripts />
      </body>
    </html>
  );
}
