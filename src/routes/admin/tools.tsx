import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { listSiteTools } from '../../lib/site-management-api';
import { Card, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/admin/tools')({
  component: AdminToolsDocsPage,
});

function CopyBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <textarea
        readOnly
        value={value}
        className="w-full min-h-[70px] rounded-md border bg-muted p-2 text-xs font-mono resize-y"
      />
    </div>
  );
}

function AdminToolsDocsPage() {
  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['site-tools', 'tools.list'],
    queryFn: listSiteTools,
    enabled: typeof window !== 'undefined',
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="text-lg font-semibold">Unified Tooling Docs</h3>
          <p className="text-sm text-muted-foreground">
            Copy/paste endpoints and commands for agent and operator workflows.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <CopyBlock title="REST list/call endpoint" value={'GET /api/site-management\nPOST /api/site-management'} />
            <CopyBlock title="MCP endpoint" value={'GET /mcp\nPOST /mcp (JSON-RPC 2.0 methods: initialize, tools/list, tools/call)'} />
            <CopyBlock
              title="CLI list tools"
              value={'pnpm site:tools:list'}
            />
            <CopyBlock
              title="CLI call tool"
              value={'pnpm site:tools:call people.list --input \'{"limit":10,"offset":0}\''}
            />
            <CopyBlock
              title="REST call example"
              value={`curl -s -X POST http://localhost:7535/api/site-management \\\n  -H 'content-type: application/json' \\\n  -d '{"tool":"people.list","input":{"limit":10,"offset":0}}'`}
            />
            <CopyBlock
              title="MCP call example"
              value={`curl -s -X POST http://localhost:7535/mcp \\\n  -H 'content-type: application/json' \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"people.list","arguments":{"limit":10,"offset":0}}}'`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-medium">Available Tools</h4>
          {isLoading && <p className="text-sm text-muted-foreground">Loading tool list...</p>}
          {!isLoading && tools.length === 0 && (
            <p className="text-sm text-muted-foreground">No tools found.</p>
          )}
          {tools.length > 0 && (
            <div className="max-h-[60vh] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left p-2">Tool</th>
                    <th className="text-left p-2">Scope</th>
                    <th className="text-left p-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map((tool) => (
                    <tr key={tool.name} className="border-b last:border-b-0">
                      <td className="p-2 font-mono text-xs">{tool.name}</td>
                      <td className="p-2 text-xs text-muted-foreground">{tool.scope}</td>
                      <td className="p-2 text-xs">{tool.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
