import { Link } from 'gatsby';
import PropTypes from 'prop-types';
import React from 'react';
import Helmet from 'react-helmet';

const Header = ({ siteTitle }) => (
  <header className="header">
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
  </header>
);

Header.propTypes = {
  siteTitle: PropTypes.string,
};

Header.defaultProps = {
  siteTitle: ``,
};

export default Header;
