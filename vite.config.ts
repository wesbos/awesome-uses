import { defineConfig } from 'vite-plus';
import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import killerInstincts from 'vite-plugin-killer-instincts';

export default defineConfig({
  staged: {
    // '*': 'vp check --fix',
    '*': 'echo "staged waiting on oxlint 0.56 to add checks back in"',
  },
  // fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  server: {
    port: 7535,
    strictPort: false,
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
