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
      <style>{`
        @scope (.Tags) {
          :scope {
            list-style-type: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-wrap: wrap;
          }
          .Tag {
            background: var(--pink);
            margin: 2px;
            border-radius: 3px;
            font-size: 1.7rem;
            text-decoration: none;
            padding: 5px;
            color: hsla(0, 100%, 100%, 0.8);
            transition: background-color 0.2s;
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            &.small { font-size: 1.2rem; }
            & input { display: none; }
            &.currentTag {
              background: var(--yellow);
              color: hsla(0, 100%, 0%, 0.8);
            }
          }
          .TagEmoji { transform: scale(1.45); }
          .TagCount {
            background: var(--blue);
            font-size: 1rem;
            color: white;
            padding: 2px;
            border-radius: 2px;
            margin-left: 5px;
          }
        }
      `}</style>
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
