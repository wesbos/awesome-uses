import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { getTagBySlug } from '../lib/data';

export const Route = createFileRoute('/tags/$tagSlug')({
  beforeLoad: ({ params }) => {
    const tag = getTagBySlug(params.tagSlug);
    if (!tag) {
      throw notFound();
    }

    throw redirect({
      to: '/like/$tag',
      params: { tag: tag.name },
    });
  },
});
