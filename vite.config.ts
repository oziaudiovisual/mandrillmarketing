import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Cast process to any to avoid "Property 'cwd' does not exist on type 'Process'" error
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false
    },
    define: {
      // We explicitly define this for LOCAL development convenience.
      // In production, the API Key is expected to be in the environment or injected window config.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    }
  };
});