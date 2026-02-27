import { Link, createFileRoute, notFound } from '@tanstack/react-router';
import BackToTop from '../components/BackToTop';
import PersonCard from '../components/PersonCard';
import { getAllTags, getDirectoryData, getTagBySlug } from '../lib/data';

export const Route = createFileRoute('/tags/$tagSlug')({
  loader: ({ params }) => {
    const tag = getTagBySlug(params.tagSlug);
    if (!tag) {
      throw notFound();
    }

    const data = getDirectoryData({ tag: tag.slug });
    return { tag, ...data };
  },
  component: TagPage,
});

function TagPage() {
  const data = Route.useLoaderData();
  const tagSlugByName = getAllTags().reduce<Record<string, string>>((acc, tag) => {
    acc[tag.name] = tag.slug;
    return acc;
  }, {});

  return (
    <>
      <h2>
        /tags/{data.tag.slug}
      </h2>
      <p>
        <strong>{data.tag.name}</strong> is used by {data.people.length} people.
      </p>
      <p>
        <Link to="/" search={{ tag: data.tag.slug }}>
          Open this as a homepage filter
        </Link>
      </p>

      <div className="People">
        {data.people.map((person) => (
          <PersonCard
            key={person.personSlug}
            person={person}
            activeTagName={data.tag.name}
            tagSlugByName={tagSlugByName}
          />
        ))}
      </div>

      <BackToTop />
    </>
  );
}
