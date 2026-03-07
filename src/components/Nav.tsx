import { useLocation } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/tags', label: 'Tags' },
  { href: '/galaxy', label: 'Galaxy' },
  { href: '/discover', label: 'Discover' },
  { href: '/uses', label: '/uses uses' },
  { href: '/add', label: 'Add Yours' },
  { href: '/admin', label: 'Admin' },
];

export default function Nav() {
  const location = useLocation();

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b pb-4">
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
    </nav>
  );
}
