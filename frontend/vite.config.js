import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react'
            }
            if (id.includes('recharts')) {
              return 'vendor-charts'
            }
            if (id.includes('framer-motion') || id.includes('react-icons')) {
              return 'vendor-ui'
            }
            if (id.includes('@tanstack/react-query') || id.includes('zustand') || id.includes('zod') || id.includes('axios')) {
              return 'vendor-utils'
            }
            return 'vendor-libs'
          }
        },
      },
    },
  },
})

