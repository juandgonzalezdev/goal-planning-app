import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Delivery snapshots are review material, not another copy of the app's tests.
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
