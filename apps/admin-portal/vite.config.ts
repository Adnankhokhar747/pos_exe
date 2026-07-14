import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: base stays './' so assets load relative to index.html on port 5174.
// Web deploy: set VITE_ADMIN_BASE=/admin/ before building — assets + router
// both resolve correctly when served at https://yourserver.com/admin/.
const base = process.env.VITE_ADMIN_BASE ?? './';

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
