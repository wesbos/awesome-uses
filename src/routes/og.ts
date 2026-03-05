import { createFileRoute } from '@tanstack/react-router';
import { ImageResponse } from 'workers-og';

export const Route = createFileRoute('/og')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const title = url.searchParams.get('title') || '/uses';
        const subtitle = url.searchParams.get('subtitle') || '';

        const html = `
          <div style="display:flex;flex-direction:column;justify-content:center;width:100%;height:100%;background:#09090b;color:#fafafa;font-family:'Fira Mono',monospace;padding:60px 80px;">
            <div style="display:flex;flex-direction:column;gap:20px;">
              <div style="display:flex;align-items:center;gap:16px;">
                <span style="font-size:32px;">🖥</span>
                <span style="font-size:28px;color:#a1a1aa;">/uses</span>
              </div>
              <h1 style="font-size:${title.length > 40 ? 48 : 64}px;font-weight:700;margin:0;line-height:1.1;max-width:900px;">${escapeHtml(title)}</h1>
              ${subtitle ? `<p style="font-size:28px;color:#a1a1aa;margin:0;max-width:800px;">${escapeHtml(subtitle)}</p>` : ''}
              <p style="font-size:22px;color:#71717a;margin-top:20px;">uses.tech</p>
            </div>
          </div>
        `;

        return new ImageResponse(html, {
          width: 1200,
          height: 630,
        });
      },
    },
  },
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
