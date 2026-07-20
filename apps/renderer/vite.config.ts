import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Web modes set VITE_WEB_BASE (e.g. /app/); EXE uses ./ (served via app:// scheme)
  const base = env.VITE_WEB_BASE || './';

  // When VITE_PROXY_TARGET is set, proxy /api/* through the dev server to avoid
  // CORS issues while testing against a remote server from localhost.
  const proxyTarget = env.VITE_PROXY_TARGET;

  return {
    plugins: [react()],
    base,
    server: {
      port: 5173,
      strictPort: true,
      ...(proxyTarget ? {
        proxy: {
          '/api': {
            target: proxyTarget,
            changeOrigin: true,
            secure: false,
          },
        },
      } : {}),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
