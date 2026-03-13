import { cn } from '@/lib/utils';

type AvatarProps = {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
} as const;

export function Avatar({ src, alt, size = 'md', className }: AvatarProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn('object-cover', sizeClasses[size], className)}
    />
  );
}
