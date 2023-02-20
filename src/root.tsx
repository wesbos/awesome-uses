import type { LinksFunction, MetaFunction } from '@remix-run/node';
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts
} from '@remix-run/react';
import Layout from './components/layout';
import styles from './styles.css';
import { countries, devices, tags } from './util/stats';
import twitterCard from './images/twitter-card.png';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: styles },
];

export function loader() {
  return {
    tags: tags(),
    countries: countries(),
    devices: devices(),
  }
}

const metaData = {
  description: `A list of /uses pages detailing developer setups.`,
  siteUrl: 'https://uses.tech',
  author: `@wesbos`,
  title: '/uses',
}

export const meta: MetaFunction = () => ({
  charset: 'utf-8',
  title: '/uses',
  viewport: 'width=device-width,initial-scale=1',
});

export default function App() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <link rel="icon" href="https://fav.farm/🖥" />
        <meta name="description" content={metaData.description} />
        <link rel="canonical" href={metaData.siteUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:creator" content="@wesbos" />
        <meta name="twitter:title" content={metaData.title} />
        <meta name="twitter:description" content={metaData.description} />
        <meta name="twitter:image" content={twitterCard} />
        <Links />
      </head>
      <body>
        <Layout>
          <Outlet />
          {/* <ScrollRestoration /> */}
          <Scripts />
          <LiveReload />
        </Layout>
      </body>
    </html>
  );
}
