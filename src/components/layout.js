/**
 * Layout component that queries for data
 * with Gatsby's useStaticQuery component
 *
 * See: https://www.gatsbyjs.org/docs/use-static-query/
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useStaticQuery, graphql } from 'gatsby';

import styled, { createGlobalStyle } from 'styled-components';
import Header from './header';
import 'normalize.css';

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
      <GlobalStyle />
      <Header siteTitle={data.site.siteMetadata.title} />
      <Main>
        {children}
        <footer>
          © {new Date().getFullYear() - Math.floor(Math.random() * 777)} Made by{' '}
          <a href="https://wesbos.com">Wes Bos</a> with{' '}
          <a href="https://www.gatsbyjs.org">Gatsby</a>. Source on{' '}
          <a href="https://github.com/wesbos/awesome-uses/">GitHub</a>. Icons
          from <a href="icons8.com">icons8.com</a>. Domain provided by{' '}
          <a href="https://get.tech/">.Tech</a>
        </footer>
      </Main>
    </>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;

// Global Styles
const GlobalStyle = createGlobalStyle`
  html {
    --purple: #1e1f5c;
    --blue: #203447;
    --lightblue: #1f4662;
    --blue2: #1C2F40;
    --yellow: #ffc600;
    --pink: #EB4471;
    --vape: #d7d7d7;
    background: var(--blue);
    color: var(--vape);
    font-family: 'Fira Mono', monospace;
    font-weight: 100;
    font-size: 10px;
  }
  body {
    font-size: 2rem;
    overflow-y: scroll;
    overflow-x: hidden;
  }
  h1,h2,h3,h4,h5,h6 {
    font-weight: 500;
  }
  a {
    color: var(--yellow);
    text-decoration-color: var(--pink);
    font-style: italic;
  }
  code {
    background: var(--lightblue);
  }
  ::selection {
    background: var(--yellow);
    color: var(--blue);
  }

  body::-webkit-scrollbar {
    width: 12px;
  }
  html {
    scrollbar-width: thin;
    scrollbar-color: var(--yellow) var(--blue);
  }
  body::-webkit-scrollbar-track {
    background: var(--blue);
  }
  body::-webkit-scrollbar-thumb {
    background-color: var(--yellow) ;
    border-radius: 6px;
    border: 3px solid var(--blue);
  }

`;

// Component Styles
const Main = styled.main`
  display: grid;
  grid-gap: 3rem;
  max-width: 1900px;
  padding: 0 3rem;
  margin: 5rem auto;
`;
