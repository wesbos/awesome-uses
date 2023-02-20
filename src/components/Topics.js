import { Link, useParams, useRouteLoaderData } from '@remix-run/react';
import * as icons from '../util/icons';

export default function Topics() {
  const { tags, countries, devices } = useRouteLoaderData("root");
  const params = useParams();
  const currentTag = params.tag || 'all';

  return (
    <div className="Tags">
      {tags.map((tag) => (
        <Link
          prefetch="intent"
          key={`tag-${tag.name}`}
          to={
            tag.name === "all" ? "/" : `/like/${encodeURIComponent(tag.name)}`
          }
          className={`Tag ${currentTag === tag.name ? "currentTag" : ""}`}
        >
          {tag.name}
          <span className="TagCount">{tag.count}</span>
        </Link>
      ))}

      {countries.map((tag) => (
        <Link
          to={`/like/${tag.emoji}`}
          prefetch="intent"
          className={`Tag ${currentTag === tag.emoji ? "currentTag" : ""}`}
          key={`filter-${tag.name}`}
          title={tag.name}
        >
          <span className="TagEmoji">{tag.emoji}</span>
          <span className="TagCount">{tag.count}</span>
        </Link>
      ))}

      {devices.map((tag) => (
        <Link
          to={`/like/${tag.name}`}
          className={`Tag ${currentTag === tag.name ? "currentTag" : ""}`}
          prefetch="intent"
          key={`filter-${tag.name}`}
          title={tag.name}
        >
          <img height="20px" src={icons[tag.name]} alt={tag.name} />
          <span className="TagCount">{tag.count}</span>
        </Link>
      ))}
    </div>
  );
}
