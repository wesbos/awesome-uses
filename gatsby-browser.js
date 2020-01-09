import React from 'react';
import { FilterProvider } from './src/context/FilterContext';
import './static/fonts.css';

export const wrapRootElement = ({ element }) => (
  <FilterProvider>{element}</FilterProvider>
);
