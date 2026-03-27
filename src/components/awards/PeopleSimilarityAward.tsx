import { Link } from '@tanstack/react-router';
import type { AwardDataMap } from '../../server/awards/types';
import type { PersonRef } from '../../server/awards/types';

function PersonBubble({ person }: { person: PersonRef }) {
  return (
    <Link
      to="/people/$personSlug"
      params={{ personSlug: person.personSlug }}
      className="flex flex-col items-center gap-1 group"
    >
      <img
        src={person.avatarUrl}
        alt={person.name}
        loading="lazy"
        className="h-10 w-10 rounded-full object-cover ring-2 ring-background"
      />
      <span className="text-[10px] text-muted-foreground group-hover:text-foreground truncate max-w-[72px] text-center">
        {person.name}
      </span>
    </Link>
  );
}

export function PeopleSimilarityAward({
  data,
  variant,
}: {
  data: AwardDataMap['most-similar-people'];
  variant?: 'similar' | 'opposite';
}) {
  const icon = variant === 'opposite' ? '⚔️' : '🤝';
  const label = variant === 'opposite' ? 'opposites' : 'twins';
  const scorePercent = Math.round(data.score * 100);

  if (!data.personA.personSlug) {
    return <span className="text-muted-foreground">Not enough data yet</span>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        <PersonBubble person={data.personA} />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-2xl">{icon}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{scorePercent}%</span>
        </div>
        <PersonBubble person={data.personB} />
      </div>
      {data.runnersUp.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          {data.runnersUp.slice(0, 3).map((r, i) => (
            <div key={`${r.personA.personSlug}-${r.personB.personSlug}`} className="flex items-center gap-1.5">
              <span className="w-4 text-center">{i + 2}.</span>
              <span className="truncate">{r.personA.name}</span>
              <span>&</span>
              <span className="truncate">{r.personB.name}</span>
              <span className="ml-auto tabular-nums font-mono">{Math.round(r.score * 100)}%</span>
            </div>
          ))}
          <p className="text-center text-[10px] italic pt-1">setup {label}</p>
        </div>
      )}
    </div>
  );
}
