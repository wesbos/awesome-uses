import { useState } from 'react';
import { toast } from 'sonner';
import { getAvatarSources, getAvatarUrl, avatarSourceToProxyUrl, type GitHubSocialAccount } from '@/lib/avatar';
import { apiMarkAvatarPersonFailed } from '@/lib/site-management-api';
import type { Person } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type AvatarDebugProps = {
  person: Pick<Person, 'url' | 'twitter' | 'github' | 'bluesky' | 'mastodon' | 'personSlug'>;
  githubSocials?: GitHubSocialAccount[];
};

export function AvatarDebug({ person, githubSocials }: AvatarDebugProps) {
  const [busy, setBusy] = useState(false);

  const sources = getAvatarSources(person, githubSocials);
  const stippledUrl = `/api/avatar/${person.personSlug}`;
  const fallbackStackUrl = getAvatarUrl(person, githubSocials);

  async function handleMarkForRegen() {
    setBusy(true);
    try {
      const result = await apiMarkAvatarPersonFailed(person.personSlug);
      toast.success(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark for regen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Avatar Debug</CardTitle>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={handleMarkForRegen}
        >
          {busy ? 'Marking…' : 'Mark for regen'}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <DebugTile label="Stippled (R2)" url={stippledUrl} />
          <DebugTile label="Fallback stack" url={fallbackStackUrl} />
          {sources.map((source) => (
            <DebugTile
              key={`${source.service}/${source.identifier}`}
              label={`${source.service}/${source.identifier}`}
              url={avatarSourceToProxyUrl(source)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DebugTile({ label, url }: { label: string; url: string }) {
  return (
    <div className="space-y-1.5">
      <div className="aspect-square overflow-hidden rounded bg-muted">
        <img
          src={url}
          alt={label}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
      <p className="text-xs font-medium truncate" title={label}>{label}</p>
      <p className="text-[10px] text-muted-foreground truncate" title={url}>{url}</p>
    </div>
  );
}
