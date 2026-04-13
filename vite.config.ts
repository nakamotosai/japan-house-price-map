import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: ['vps-jp.tail4b5213.ts.net'],
  },
  test: {
    environment: 'node',
  },
})
