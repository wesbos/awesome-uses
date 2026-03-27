import { Link } from '@tanstack/react-router';
import type { AwardDataMap } from '../../server/awards/types';

export function DomainLengthAward({ data, variant }: { data: AwardDataMap['longest-domain']; variant?: 'longest' | 'shortest' }) {
  const icon = variant === 'shortest' ? '🐁' : '🦕';

  return (
    <Link
      to="/people/$personSlug"
      params={{ personSlug: data.person.personSlug }}
      className="flex items-center gap-3 group"
    >
      <span className="text-2xl">{icon}</span>
      <div className="min-w-0">
        <p className="font-mono font-semibold text-foreground group-hover:underline truncate">
          {data.domain}
        </p>
        <p className="text-xs text-muted-foreground">
          {data.person.name} — {data.length} characters
        </p>
      </div>
    </Link>
  );
}
