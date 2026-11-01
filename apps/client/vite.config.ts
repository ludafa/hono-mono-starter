import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load shared config from the repo root .env (see <repo>/.env.example).
  // Server-only secrets in apps/server/.env are NOT read here — and even if
  // the path were widened, only `VITE_*` vars are exposed to the client bundle.
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');

  const serverPort = Number(env.SERVER_PORT ?? 3000);
  const clientPort = Number(env.CLIENT_PORT ?? 5173);
  const serverUrl = env.SERVER_URL ?? `http://localhost:${serverPort}`;
  const isDev = mode === 'development';

  console.log(
    `Vite dev server running on port ${clientPort}, proxying API requests to ${serverUrl}`,
  );

  return {
    plugins: [tanstackRouter(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: clientPort,
      proxy: {
        '/api': {
          target: serverUrl,
          changeOrigin: true,
        },
      },
    },
    // See apps/docs/dev-auto-login/tech.md §4.1.
    define: {
      'import.meta.env.VITE_DEV_AUTO_LOGIN': JSON.stringify(
        command === 'serve' && env.DEV_AUTO_LOGIN === 'true',
      ),
      ...(isDev
        ? {}
        : { 'import.meta.env.VITE_API_URL': JSON.stringify(serverUrl) }),
    },
  };
});
