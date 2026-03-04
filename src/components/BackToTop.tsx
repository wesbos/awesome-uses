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
    <div>
      <style>{`
        @scope (.BackToTopLink) {
          :scope {
            position: fixed;
            bottom: 1%;
            right: 1%;
            color: white;
            background: rgba(0, 0, 0, 0.5);
            cursor: pointer;
            border-radius: 3px;
            padding: 1rem;
            transition: opacity 0.2s;
            opacity: 0;
            text-decoration: none;
            &.Show { opacity: 1; }
            @media screen and (max-width: 500px) { display: none; }
          }
        }
      `}</style>
      <a className={`BackToTopLink ${percent > 0.25 ? 'Show' : ''}`} href="#top">
        &uarr;
      </a>
    </div>
  );
}
