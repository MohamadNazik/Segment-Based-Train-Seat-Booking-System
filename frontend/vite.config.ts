import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Mirrors nginx.conf's /api/ proxy in production, so `npm run dev`
      // works standalone against a locally running backend without the
      // frontend needing to know its actual host/port.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
