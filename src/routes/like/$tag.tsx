import { createFileRoute, redirect } from '@tanstack/react-router';
import { resolveLegacyTagInput } from '../../lib/data';

export const Route = createFileRoute('/like/$tag')({
  beforeLoad: ({ params }) => {
    const result = resolveLegacyTagInput(params.tag);

    if (result.redirectTo === '/tags/$tagSlug') {
      throw redirect({
        to: '/tags/$tagSlug',
        params: result.params,
      });
    }

    throw redirect({
      to: '/',
      search: result.search,
    });
  },
});
