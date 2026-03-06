import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { $previewTagReclassify, $applyTagReclassify, type ReclassifyPreviewPayload } from '../../server/fn/tags';
import { $getAdminDashboardData } from '../../server/fn/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/admin/tags')({
  component: TagsPage,
});

function TagsPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await $getAdminDashboardData();
        if (!cancelled) setCategories(data.categories);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading categories...</p>;

  return (
    <div className="space-y-4">
      <ReclassifyCard categories={categories} />
    </div>
  );
}

function ReclassifyCard({ categories }: { categories: string[] }) {
  const [category, setCategory] = useState(() =>
    categories.length > 0 ? categories[0] : 'other'
  );
  const [minUsers, setMinUsers] = useState(2);
  const [limit, setLimit] = useState(80);
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState<ReclassifyPreviewPayload | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function runPreview() {
    setMessage(null);
    setPreviewing(true);
    setPreview(null);
    try {
      const result = await $previewTagReclassify({
        data: {
          category,
          minUsers,
          limit,
          prompt: prompt || undefined,
        },
      });
      setPreview(result);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Failed to preview reclassification.' });
    } finally {
      setPreviewing(false);
    }
  }

  async function apply() {
    if (!preview) return;
    const assignments = preview.output.items.map((item) => ({
      item: item.item,
      categories: item.categories,
    }));
    setApplying(true);
    setMessage(null);
    try {
      const result = await $applyTagReclassify({
        data: { category: preview.category, assignments },
      });
      setMessage({
        ok: true,
        text: `Applied reclassification: ${result.updatedRows} rows across ${result.updatedItems} items.`,
      });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Failed to apply reclassification.' });
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h4 className="font-medium">Reclassify tags with AI</h4>
        <div className="grid gap-2 md:grid-cols-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
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
          <Button onClick={runPreview} disabled={previewing}>
            {previewing ? 'Previewing...' : 'Preview'}
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
                    {entry.categories.join(', ')}
                  </span>
                </div>
              ))}
            </div>
            <Button onClick={apply} disabled={applying}>
              {applying ? 'Applying...' : 'Apply reclassification'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
