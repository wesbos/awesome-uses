import React, { useState, useEffect } from 'react';

function useScrollPosition() {
  const [percent, setPercent] = useState(0);

  function handleScroll(event) {
    const scrollTop =
      document.scrollingElement.scrollHeight -
      document.documentElement.clientHeight;
    const howFar = document.documentElement.scrollTop / scrollTop;
    setPercent(howFar);
  }

  useEffect(() => {
    // listen for window scroll event
    document.addEventListener('scroll', handleScroll);
    return () => {
      document.removeEventListener('scroll', handleScroll);
    };
  });

  return percent;
}

export default function BackToTop() {
  const percent = useScrollPosition();
  return (
    <a className="BackToTopLink" href="#top" title="Back To Top" percent={percent}>
      &uarr;
    </a>
  );
}
