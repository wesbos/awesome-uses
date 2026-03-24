import { getAllPeople } from '../../lib/data';
import { getAvatarUrl } from '../../lib/avatar';
import type { ItemDetail } from '../db/items.server';

export const BATCH_CONCURRENCY = 10;

export async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(values[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

export type Face = { personSlug: string; name: string; avatarUrl: string; description?: string };

export type TagItemWithFaces = {
  item: string;
  itemSlug: string;
  count: number;
  faces: Face[];
};

type ItemTagRelationWithFaces = {
  tag: string;
  tagSlug: string;
  faces: Face[];
  relatedItems: TagItemWithFaces[];
};

export type BaseItemDetail = Omit<ItemDetail, 'people' | 'tagRelations' | 'tags'> & {
  faces: Face[];
  tags: Array<{ name: string; slug: string }>;
  tagRelations: ItemTagRelationWithFaces[];
};

export function slugToFace(
  slug: string,
  peopleMap: Map<string, ReturnType<typeof getAllPeople>[number]>,
  { includeDescription = false }: { includeDescription?: boolean } = {},
): Face | null {
  const person = peopleMap.get(slug);
  if (!person) return null;
  const face: Face = {
    personSlug: person.personSlug,
    name: person.name,
    avatarUrl: getAvatarUrl(person),
  };
  if (includeDescription) {
    face.description = person.description;
  }
  return face;
}

export function mapItemDetailWithFaces(detail: ItemDetail): BaseItemDetail {
  const allPeople = getAllPeople();
  const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

  return {
    item: detail.item,
    itemSlug: detail.itemSlug,
    totalPeople: detail.totalPeople,
    faces: detail.people
      .map((slug) => slugToFace(slug, peopleMap, { includeDescription: true }))
      .filter((f): f is Face => f !== null),
    tags: detail.tags.map((name) => {
      const relation = detail.tagRelations.find((entry) => entry.tag === name);
      return {
        name,
        slug: relation?.tagSlug || name.toLowerCase(),
      };
    }),
    tagRelations: detail.tagRelations.map((relation) => ({
      tag: relation.tag,
      tagSlug: relation.tagSlug,
      faces: relation.people
        .map((slug) => slugToFace(slug, peopleMap))
        .filter((f): f is Face => f !== null),
      relatedItems: relation.relatedItems.map((item) => ({
        item: item.item,
        itemSlug: item.itemSlug,
        count: item.count,
        faces: item.personSlugs
          .map((slug) => slugToFace(slug, peopleMap))
          .filter((f): f is Face => f !== null),
      })),
    })),
  };
}
