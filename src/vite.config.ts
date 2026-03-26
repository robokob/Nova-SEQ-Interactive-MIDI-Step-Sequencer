import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: './', // Important for Electron
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 5173,
    host: 'localhost'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
})