import { cn } from '@/lib/utils';

type FacePileProps = {
  faces: { name: string; avatarUrl: string }[];
  max?: number;
  size?: 'sm' | 'md';
};

export function FacePile({ faces, max = 4, size = 'sm' }: FacePileProps) {
  const visible = faces.slice(0, max);
  const overflow = faces.length - max;

  const sizeClasses = {
    sm: 'h-6 w-6 text-[9px]',
    md: 'h-8 w-8 text-[10px]',
  };

  return (
    <div className="flex items-center">
      {visible.map((face, i) => (
        <img
          key={face.name}
          src={face.avatarUrl}
          alt={face.name}
          title={face.name}
          loading="lazy"
          className={cn(
            'rounded-full border-2 border-background object-cover',
            sizeClasses[size],
            i > 0 && '-ml-2',
          )}
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'flex items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground font-medium -ml-2',
            sizeClasses[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
