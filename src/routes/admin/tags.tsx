import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  apiApplyTagReclassify,
  apiGetTags,
  apiPreviewTagReclassify,
} from '../../lib/site-management-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

type ReclassifyPreviewPayload = {
  tag: string;
  minUsers: number;
  totalCandidates: number;
  candidates: Array<{ item: string; count: number }>;
  output: { items: Array<{ item: string; tags: string[]; reasoning: string }> };
};

export const Route = createFileRoute('/admin/tags')({
  component: TagsPage,
});

function TagsPage() {
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['site-tools', 'tags.list'],
    queryFn: apiGetTags,
    enabled: typeof window !== 'undefined',
  });

  if (isLoading) return <p className="text-muted-foreground">Loading tags...</p>;

  return (
    <div className="space-y-4">
      <ReclassifyCard tags={tags} />
    </div>
  );
}

function ReclassifyCard({ tags }: { tags: string[] }) {
  const [tag, setTag] = useState(() =>
    tags.length > 0 ? tags[0] : 'other'
  );
  const [minUsers, setMinUsers] = useState(2);
  const [limit, setLimit] = useState(80);
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState<ReclassifyPreviewPayload | null>(null);
  const previewMutation = useMutation({
    mutationFn: apiPreviewTagReclassify,
  });
  const applyMutation = useMutation({
    mutationFn: apiApplyTagReclassify,
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!tags.length) return;
    if (!tags.includes(tag)) {
      setTag(tags[0]);
    }
  }, [tags, tag]);

  async function runPreview() {
    setMessage(null);
    setPreview(null);
    try {
      const result = await previewMutation.mutateAsync({
        tag,
        minUsers,
        limit,
        prompt: prompt || undefined,
      });
      setPreview(result);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Failed to preview reclassification.' });
    }
  }

  async function apply() {
    if (!preview) return;
    const assignments = preview.output.items.map((item) => ({
      item: item.item,
      tags: item.tags,
    }));
    setMessage(null);
    try {
      const result = await applyMutation.mutateAsync({
        tag: preview.tag,
        assignments,
      });
      setMessage({
        ok: true,
        text: `Applied reclassification: ${result.updatedRows} rows across ${result.updatedItems} items.`,
      });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Failed to apply reclassification.' });
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h4 className="font-medium">Reclassify tags with AI</h4>
        <div className="grid gap-2 md:grid-cols-4">
          <TagCombobox
            tags={tags}
            value={tag}
            onChange={setTag}
          />
          <Input
            type="number"
            min={1}
            value={minUsers}
            onChange={(e) => setMinUsers(Number(e.target.value) || 1)}
            placeholder="Min users"
          />
          <Input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 1)}
            placeholder="Item limit"
          />
          <Button onClick={runPreview} disabled={previewMutation.isPending}>
            {previewMutation.isPending ? 'Previewing...' : 'Preview'}
          </Button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Optional custom prompt"
          className="w-full min-h-[90px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />

        {message && (
          <p className={`text-xs ${message.ok ? 'text-muted-foreground' : 'text-destructive font-medium'}`}>{message.text}</p>
        )}

        {preview && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Candidate items: {preview.totalCandidates}
            </p>
            <div className="max-h-72 overflow-auto rounded-md border p-2 text-sm space-y-1">
              {preview.output.items.map((entry) => (
                <div key={entry.item} className="flex items-start justify-between gap-3">
                  <span>{entry.item}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.tags.join(', ')}
                  </span>
                </div>
              ))}
            </div>
            <Button onClick={apply} disabled={applyMutation.isPending}>
              {applyMutation.isPending ? 'Applying...' : 'Apply reclassification'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TagCombobox({
  tags,
  value,
  onChange,
}: {
  tags: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 justify-between"
        >
          {value || 'Select tag...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder="Filter tags..." />
          <CommandList>
            <CommandEmpty>No tag found.</CommandEmpty>
            <CommandGroup>
              {tags.map((t) => (
                <CommandItem
                  key={t}
                  value={t}
                  onSelect={(selected) => {
                    onChange(selected);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === t ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {t}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
