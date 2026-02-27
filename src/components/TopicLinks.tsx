import { Link } from '@tanstack/react-router';
import type {
  CountrySummary,
  DeviceSummary,
  DirectoryFilters,
  TagSummary,
} from '../lib/types';

type TopicLinksProps = {
  tags: TagSummary[];
  countries: CountrySummary[];
  devices: DeviceSummary[];
  currentFilters: DirectoryFilters;
};

export default function TopicLinks({
  tags,
  countries,
  devices,
  currentFilters,
}: TopicLinksProps) {
  return (
    <div className="Tags">
      {tags.slice(0, 120).map((tag) => (
        <Link
          key={`tag-${tag.slug}`}
          to="/tags/$tagSlug"
          params={{ tagSlug: tag.slug }}
          className={`Tag ${currentFilters.tag === tag.slug ? 'currentTag' : ''}`}
        >
          {tag.name}
          <span className="TagCount">{tag.count}</span>
        </Link>
      ))}

      {countries.slice(0, 40).map((country) => (
        <Link
          key={`country-${country.emoji}`}
          to="/"
          search={(previous) => ({ ...previous, country: country.emoji })}
          className={`Tag ${currentFilters.country === country.emoji ? 'currentTag' : ''}`}
          title={country.emoji}
        >
          <span className="TagEmoji">{country.emoji}</span>
          <span className="TagCount">{country.count}</span>
        </Link>
      ))}

      {devices.map((device) => (
        <Link
          key={`device-${device.name}`}
          to="/"
          search={(previous) => ({ ...previous, device: device.name })}
          className={`Tag ${currentFilters.device === device.name ? 'currentTag' : ''}`}
          title={device.name}
        >
          {device.name}
          <span className="TagCount">{device.count}</span>
        </Link>
      ))}
    </div>
  );
}
