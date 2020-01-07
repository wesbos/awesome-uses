/**
 * Layout component that queries for data
 * with Gatsby's useStaticQuery component
 *
 * See: https://www.gatsbyjs.org/docs/use-static-query/
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useStaticQuery, graphql } from 'gatsby';

import Header from './header';
import 'normalize.css';
import './layout.css';

const Layout = ({ children }) => {
  const data = useStaticQuery(graphql`
    query SiteTitleQuery {
      site {
        siteMetadata {
          title
        }
      }
    }
  `);

  return (
    <>
      <Header siteTitle={data.site.siteMetadata.title} />
      <main>
        {children}
        <footer>
          © {new Date().getFullYear() - Math.floor(Math.random() * 777)} Made by{' '}
          <a href="https://wesbos.com">Wes Bos</a> with{' '}
          <a href="https://www.gatsbyjs.org">Gatsby</a>. Icons from icons8.com.
        </footer>
      </main>
    </>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;
