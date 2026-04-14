import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'vendor-react'
          }

          return 'vendor-misc'
        },
      },
    },
  },
  preview: {
    allowedHosts: ['vps-jp.tail4b5213.ts.net', 'tokyohouse.saaaai.com'],
  },
  test: {
    environment: 'node',
  },
})
