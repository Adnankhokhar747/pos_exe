import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Web modes set VITE_WEB_BASE (e.g. /app/); EXE uses ./ (served via app:// scheme)
  const base = env.VITE_WEB_BASE || './';
  return {
    plugins: [react()],
    base,
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
