import { Link } from 'gatsby';
import PropTypes from 'prop-types';
import React from 'react';
import Helmet from 'react-helmet';
import styled from 'styled-components';

const Header = ({ siteTitle }) => (
  <HeaderWrapper className="header">
    <Helmet>
      <title>{siteTitle}</title>
    </Helmet>
    <div>
      <h1>
        <Link to="/">/uses</Link>
      </h1>
      <p>
        A list of <code>/uses</code> pages detailing developer setups, gear,
        software and configs.
      </p>
    </div>
  </HeaderWrapper>
);

Header.propTypes = {
  siteTitle: PropTypes.string,
};

Header.defaultProps = {
  siteTitle: ``,
};

export default Header;

// Component Styles
const HeaderWrapper = styled.header`
  text-align: center;
  h1 {
    font-size: 6rem;
  }
`;
