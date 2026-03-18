import { defineConfig } from 'vite-plus';
import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import killerInstincts from 'vite-plugin-killer-instincts';

export default defineConfig({
  staged: {
    '*': 'echo "staged"',
  },
  // fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  server: {
    port: 7535,
    strictPort: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    react(),
    killerInstincts({ autoKill: true }),
  ],
});
