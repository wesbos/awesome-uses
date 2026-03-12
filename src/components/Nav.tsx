import { useLocation } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { ModeToggle } from './ModeToggle';
import { getAllPeople } from '../lib/data';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/tags', label: 'Tags' },
  { href: '/galaxy', label: 'Galaxy' },
  { href: '/discover', label: 'Discover' },
  { href: '/uses', label: '/uses uses' },
  { href: '/admin', label: 'Admin' },
];

export default function Nav() {
  const location = useLocation();
  const addYoursActive = location.pathname.startsWith('/add');

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b pb-4">
      <a
        href="/"
        className="mr-4 font-bold tracking-tight text-foreground hover:text-foreground/80 transition-colors font-heading leading-none"
        style={{ fontSize: '70px' }}
      >
        <span className="text-yellow-400">/</span>uses
      </a>
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive = href === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(href);

        return (
          <a
            key={href}
            href={href}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {label}
          </a>
        );
      })}
      <a
        href="/add"
        className={cn(
          'ml-auto px-3 py-1.5 text-sm rounded-md font-medium transition-colors',
          addYoursActive
            ? 'bg-primary text-primary-foreground'
            : 'bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground',
        )}
      >
        + Add Yours <span className="text-muted-foreground font-normal">({getAllPeople().length})</span>
      </a>
      <ModeToggle />
    </nav>
  );
}
