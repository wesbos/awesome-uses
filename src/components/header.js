import { Link } from 'gatsby';
import PropTypes from 'prop-types';
import React from 'react';

const Header = ({ siteTitle }) => (
  <header className="header">
    <div>
      <h1>
        <Link to="/">/uses</Link>
      </h1>
      <p>
        A list of <code>/uses</code> pages detailing developer setups.
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
