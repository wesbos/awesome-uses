import { createServerFn } from '@tanstack/react-start';
import { getAllPeople } from '../../lib/data';
import type { TagSummary, TagDetail, ReclassifyAssignment } from '../db';
import { getAllTagSummaries, getTagDetailBySlug, applyTagReclassification } from '../db';
import { previewTagReclassification } from '../reclassify';
import { slugToFace, type Face, type TagItemWithFaces } from './helpers';

export type TagSummaryWithFaces = Omit<TagSummary, 'topItems' | 'personSlugs'> & {
  faces: Face[];
  topItems: TagItemWithFaces[];
};

export const $getTagSummaries = createServerFn({ method: 'GET' }).handler(
  async (): Promise<TagSummaryWithFaces[]> => {
    const tags = await getAllTagSummaries();
    const allPeople = getAllPeople();
    const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

    return tags.map((tag) => ({
      ...tag,
      faces: tag.personSlugs
        .map((slug) => slugToFace(slug, peopleMap))
        .filter((f): f is Face => f !== null),
      topItems: tag.topItems.map((ti) => ({
        item: ti.item,
        itemSlug: ti.itemSlug,
        count: ti.count,
        faces: ti.personSlugs
          .map((slug) => slugToFace(slug, peopleMap))
          .filter((f): f is Face => f !== null),
      })),
    }));
  }
);

export type TagDetailWithFaces = Omit<TagDetail, 'people' | 'items'> & {
  faces: Face[];
  items: TagItemWithFaces[];
};

export const $getTagDetail = createServerFn({ method: 'GET' })
  .inputValidator((tagSlug: string) => tagSlug)
  .handler(async ({ data: tagSlug }): Promise<TagDetailWithFaces | null> => {
    const detail = await getTagDetailBySlug(tagSlug);
    if (!detail) return null;

    const allPeople = getAllPeople();
    const peopleMap = new Map(allPeople.map((p) => [p.personSlug, p]));

    return {
      tag: detail.tag,
      tagSlug: detail.tagSlug,
      totalItems: detail.totalItems,
      totalPeople: detail.totalPeople,
      faces: detail.people
        .map((slug) => slugToFace(slug, peopleMap))
        .filter((f): f is Face => f !== null),
      items: detail.items.map((item) => ({
        item: item.item,
        itemSlug: item.itemSlug,
        count: item.count,
        faces: item.personSlugs
          .map((slug) => slugToFace(slug, peopleMap))
          .filter((f): f is Face => f !== null),
      })),
    };
  });

type ReclassifyPreviewInput = {
  category: string;
  minUsers: number;
  limit: number;
  prompt?: string;
  model?: string;
};

export type ReclassifyPreviewPayload = Awaited<
  ReturnType<typeof previewTagReclassification>
>;

export const $previewTagReclassify = createServerFn({ method: 'POST' })
  .inputValidator((input: ReclassifyPreviewInput) => input)
  .handler(async ({ data }) => {
    return previewTagReclassification(data);
  });

type ApplyReclassifyInput = {
  category: string;
  assignments: ReclassifyAssignment[];
};

export const $applyTagReclassify = createServerFn({ method: 'POST' })
  .inputValidator((input: ApplyReclassifyInput) => input)
  .handler(async ({ data }) => {
    return applyTagReclassification(data.category, data.assignments);
  });
