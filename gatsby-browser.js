import React from "react";
import { FilterProvider } from "./src/context/FilterContext";
import "typeface-fira-mono";

export const wrapRootElement = ({ element }) => (
  <FilterProvider>{element}</FilterProvider>
);
