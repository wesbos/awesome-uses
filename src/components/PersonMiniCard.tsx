import { Link } from '@tanstack/react-router';
import type { Face } from '../server/functions';

type PersonMiniCardProps = {
  face: Face;
};

export function PersonMiniCard({ face }: PersonMiniCardProps) {
  return (
    <Link
      to="/people/$personSlug"
      params={{ personSlug: face.personSlug }}
      className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/40 transition-colors"
    >
      <img
        src={face.avatarUrl}
        alt={face.name}
        loading="lazy"
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{face.name}</p>
        {face.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {face.description}
          </p>
        )}
      </div>
    </Link>
  );
}
