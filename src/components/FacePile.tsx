import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type FacePileProps = {
  faces: { personSlug: string; name: string; avatarUrl: string }[];
  max?: number;
  size?: 'sm' | 'md';
};

export function FacePile({ faces, max = 4, size = 'sm' }: FacePileProps) {
  const visible = faces.slice(0, max);
  const overflow = faces.length - max;
  const hidden = faces.slice(max);

  const sizeClasses = {
    sm: 'h-6 w-6 text-[9px]',
    md: 'h-8 w-8 text-[10px]',
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center">
        {visible.map((face, i) => (
          <Tooltip key={`${face.personSlug}-${i}`}>
            <TooltipTrigger asChild>
              <Link
                to="/people/$personSlug"
                params={{ personSlug: face.personSlug }}
                aria-label={face.name}
                className={cn(
                  'rounded-full border-2 border-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                  i > 0 && '-ml-2',
                )}
              >
                <img
                  src={face.avatarUrl}
                  alt={face.name}
                  loading="lazy"
                  className={cn(
                    'rounded-full object-cover',
                    sizeClasses[size],
                  )}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent>{face.name}</TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'flex items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground font-medium -ml-2',
                  sizeClasses[size],
                )}
              >
                +{overflow}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {hidden.map((f) => f.name).join(', ')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
