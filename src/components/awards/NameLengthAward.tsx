import { Link } from '@tanstack/react-router';
import type { AwardDataMap } from '../../server/awards/types';

export function NameLengthAward({ data, variant }: { data: AwardDataMap['longest-name']; variant?: 'longest' | 'shortest' }) {
  const icon = variant === 'shortest' ? '✂️' : '📏';

  return (
    <Link
      to="/people/$personSlug"
      params={{ personSlug: data.person.personSlug }}
      className="flex items-center gap-3 group"
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="font-semibold text-foreground group-hover:underline">
          {data.person.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {data.length} characters — {"'".repeat(Math.min(data.length, 30))}
        </p>
      </div>
    </Link>
  );
}
