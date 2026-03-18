import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getStippledAvatarUrl } from '@/lib/avatar';

type AvatarProps = {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  personSlug?: string;
};

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
} as const;

export function Avatar({ src, alt, size = 'md', className, personSlug }: AvatarProps) {
  const [useFallback, setUseFallback] = useState(false);
  const imgSrc = personSlug && !useFallback ? getStippledAvatarUrl(personSlug) : src;

  return (
    <img
      src={imgSrc}
      alt={alt}
      loading="lazy"
      className={cn('object-cover', sizeClasses[size], className)}
      onError={() => {
        if (!useFallback) setUseFallback(true);
      }}
    />
  );
}
