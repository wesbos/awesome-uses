import React from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import FavIcon from './FavIcon';

function Header({ siteTitle, siteDescription, siteUrl }) {

  return (
    <div className="header HeaderWrapper">
      <FavIcon />
      <div>
        <h1 id="top">
          <a href="/">/uses</a>
        </h1>
        <p>
          A list of <code>/uses</code> pages detailing developer setups, gear,
          software and configs.
        </p>
      </div>
    </div>
  );
}
Header.propTypes = {
  siteTitle: PropTypes.string,
  siteDescription: PropTypes.string,
  siteUrl: PropTypes.string,
};

Header.defaultProps = {
  siteTitle: '',
  siteDescription: '',
  siteUrl: '',
};

export default Header;
