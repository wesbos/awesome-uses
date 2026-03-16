import { Link } from '@tanstack/react-router';
import type { PersonRef } from '../../server/awards/types';

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

export function PersonAvatar({ person, size = 24 }: { person: PersonRef; size?: number }) {
  return (
    <Link to="/people/$personSlug" params={{ personSlug: person.personSlug }}>
      <img
        src={person.avatarUrl}
        alt={person.name}
        loading="lazy"
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0 ring-2 ring-background"
      />
    </Link>
  );
}

export function Medal({ place }: { place: number }) {
  const medals = ['🥇', '🥈', '🥉'];
  if (place < medals.length) {
    return <span className="text-base leading-none">{medals[place]}</span>;
  }
  return <span className="text-xs text-muted-foreground w-5 text-center">{place + 1}.</span>;
}

export function RankedRow({ place, children }: { place: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Medal place={place} />
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}
