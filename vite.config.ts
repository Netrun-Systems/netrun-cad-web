import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', '@tanstack/react-query'],
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
          'vendor-pdf': ['jspdf'],
          'vendor-ifc': ['web-ifc'],
          'vendor-icons': ['lucide-react'],
          'vendor-canvas': ['perfect-freehand'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
});
