import { defineConfig } from 'vite-plus';
import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import killerInstincts from 'vite-plugin-killer-instincts';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  fmt: {},
  staged: {
    "src/data.js": [
      "eslint --fix",
      "git add"
    ]
  },
  server: {
    port: 7535,
    strictPort: true,
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart(),
    react(),
    killerInstincts({ autoKill: true }),
  ],
});
