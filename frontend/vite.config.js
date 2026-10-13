import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        // must match PORT in backend/.env (server default is 5001)
        target: process.env.API_TARGET || 'http://localhost:5001',
        changeOrigin: true
      },
      // listing photos saved by the backend
      '/uploads': {
        target: process.env.API_TARGET || 'http://localhost:5001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  },
  // the on-device AI runs in a module Web Worker (utils/visionWorker.js)
  worker: {
    format: 'es'
  }
})