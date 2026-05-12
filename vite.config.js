import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  publicDir: 'public',
  build: {
    // Source maps in produzione: stack trace leggibili nell'ErrorBoundary.
    // Disabilitabile quando l'app e' stabile.
    sourcemap: true,
  },
});
