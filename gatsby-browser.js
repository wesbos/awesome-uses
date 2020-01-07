import React from 'react';
import { FilterProvider } from './src/context/FilterContext';

export const wrapRootElement = ({ element }) => (
  <FilterProvider>{element}</FilterProvider>
)
