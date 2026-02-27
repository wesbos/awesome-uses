import { Link } from '@tanstack/react-router';
import type {
  CountrySummary,
  DeviceSummary,
  TagSummary,
} from '../lib/types';

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
    <div className="Tags">
      {tags.slice(0, 120).map((tag) => (
        <Link
          key={`tag-${tag.slug}`}
          to="/like/$tag"
          params={{ tag: tag.name }}
          className={`Tag ${isCurrentTag(tag.name) ? 'currentTag' : ''}`}
        >
          {tag.name}
          <span className="TagCount">{tag.count}</span>
        </Link>
      ))}

      {countries.slice(0, 40).map((country) => (
        <Link
          key={`country-${country.emoji}`}
          to="/like/$tag"
          params={{ tag: country.emoji }}
          className={`Tag ${isCurrentTag(country.emoji) ? 'currentTag' : ''}`}
          title={country.emoji}
        >
          <span className="TagEmoji">{country.emoji}</span>
          <span className="TagCount">{country.count}</span>
        </Link>
      ))}

      {devices.map((device) => (
        <Link
          key={`device-${device.name}`}
          to="/like/$tag"
          params={{ tag: device.name }}
          className={`Tag ${isCurrentTag(device.name) ? 'currentTag' : ''}`}
          title={device.name}
        >
          {device.name}
          <span className="TagCount">{device.count}</span>
        </Link>
      ))}
    </div>
  );
}
