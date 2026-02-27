import { useEffect, useState } from 'react';

function useScrollPercent() {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop =
        document.scrollingElement?.scrollHeight || document.documentElement.scrollHeight;
      const viewport = document.documentElement.clientHeight;
      const track = scrollTop - viewport;
      const ratio = track > 0 ? document.documentElement.scrollTop / track : 0;
      setPercent(ratio);
    };

    document.addEventListener('scroll', onScroll);
    return () => document.removeEventListener('scroll', onScroll);
  }, []);

  return percent;
}

export default function BackToTop() {
  const percent = useScrollPercent();
  return (
    <a className={`BackToTopLink ${percent > 0.25 ? 'Show' : ''}`} href="#top">
      &uarr;
    </a>
  );
}
