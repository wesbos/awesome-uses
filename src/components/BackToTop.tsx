import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

function useScrollPercent() {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop =
        document.scrollingElement?.scrollHeight ||
        document.documentElement.scrollHeight;
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
    <Button
      variant="outline"
      size="icon"
      className={`fixed bottom-4 right-4 transition-opacity ${
        percent > 0.25 ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      asChild
    >
      <a href="#top">
        <ArrowUp className="h-4 w-4" />
      </a>
    </Button>
  );
}
