import { defineConfig } from 'vite';
import path from 'path';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [basicSsl()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  optimizeDeps: {
    // Exclui o mediapipe do bundling do Vite (tem arquivos .wasm próprios)
    exclude: ['@mediapipe/tasks-vision'],
  },
  build: {
    target: 'es2022',
    minify: 'esbuild',
  },
});
