import { Link, Outlet, createFileRoute, useLocation } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/scrape', label: 'Scrape' },
  { href: '/admin/items', label: 'Items' },
  { href: '/admin/tags', label: 'Tags' },
  { href: '/admin/awards', label: 'Awards' },
  { href: '/admin/merge', label: 'Merge' },
  { href: '/admin/batch', label: 'Batch Ops' },
  { href: '/admin/review', label: 'Review' },
  { href: '/admin/errors', label: 'Errors' },
  { href: '/admin/avatars', label: 'Avatars' },
  { href: '/admin/tools', label: 'Tooling Docs' },
];

function AdminLayout() {
  const location = useLocation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Admin</h2>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to site
        </Link>
      </div>

      <nav className="flex flex-wrap items-center gap-1 border-b pb-3">
        {ADMIN_NAV.map(({ href, label, exact }) => {
          const isActive = exact
            ? location.pathname === href
            : location.pathname.startsWith(href);

          return (
            <Link
              key={href}
              to={href}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
