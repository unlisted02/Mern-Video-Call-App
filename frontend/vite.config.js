import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
    strictPort: true,
  },
})
