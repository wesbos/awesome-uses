import { Link } from '@tanstack/react-router';
import type { CountrySummary, DeviceSummary, TagSummary } from '../lib/types';
import { Badge } from '@/components/ui/badge';

type TopicLinksProps = {
  tags: TagSummary[];
  countries: CountrySummary[];
  devices: DeviceSummary[];
  currentTag?: string;
};

export default function TopicLinks({
  tags,
  countries,
  devices,
  currentTag,
}: TopicLinksProps) {
  function isCurrentTag(candidate: string): boolean {
    if (!currentTag) return false;
    return currentTag.toLowerCase() === candidate.toLowerCase();
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 120).map((tag) => (
        <Link key={`tag-${tag.slug}`} to="/like/$tag" params={{ tag: tag.name }}>
          <Badge
            variant={isCurrentTag(tag.name) ? 'default' : 'outline'}
            className="cursor-pointer gap-1"
          >
            {tag.name}
            <span className="text-[10px] opacity-60">{tag.count}</span>
          </Badge>
        </Link>
      ))}

      {countries.slice(0, 40).map((country) => (
        <Link
          key={`country-${country.emoji}`}
          to="/like/$tag"
          params={{ tag: country.emoji }}
        >
          <Badge
            variant={isCurrentTag(country.emoji) ? 'default' : 'outline'}
            className="cursor-pointer gap-1 text-base"
          >
            {country.emoji}
            <span className="text-[10px] opacity-60">{country.count}</span>
          </Badge>
        </Link>
      ))}

      {devices.map((device) => (
        <Link
          key={`device-${device.name}`}
          to="/like/$tag"
          params={{ tag: device.name }}
        >
          <Badge
            variant={isCurrentTag(device.name) ? 'default' : 'outline'}
            className="cursor-pointer gap-1"
          >
            {device.name}
            <span className="text-[10px] opacity-60">{device.count}</span>
          </Badge>
        </Link>
      ))}
    </div>
  );
}
