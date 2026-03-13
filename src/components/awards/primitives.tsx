import { Link } from '@tanstack/react-router';

export function PersonLink({ name, slug }: { name: string; slug: string }) {
  return (
    <Link
      to="/people/$personSlug"
      params={{ personSlug: slug }}
      className="font-semibold text-foreground hover:underline"
    >
      {name}
    </Link>
  );
}

export function Stat({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-semibold text-(--yellow)">{children}</span>
  );
}
