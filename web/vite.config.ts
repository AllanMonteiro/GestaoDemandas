import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const hmrClientPort = Number(env.HMR_CLIENT_PORT || env.VITE_HMR_CLIENT_PORT || 5173);

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      watch: {
        usePolling: true,
      },
      hmr: {
        clientPort: hmrClientPort,
      },
    },
  };
});
