import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // FIX: Cast `process` to `any` to bypass TypeScript error for `cwd`.
  // This is needed if @types/node is not available in the environment.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
      'process.env.API_KEY_1': JSON.stringify(env.VITE_API_KEY_1),
      'process.env.API_KEY_2': JSON.stringify(env.VITE_API_KEY_2),
      'process.env.API_KEY_3': JSON.stringify(env.VITE_API_KEY_3),
    },
    build: {
      rollupOptions: {
        external: [
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        ]
      }
    }
  }
});