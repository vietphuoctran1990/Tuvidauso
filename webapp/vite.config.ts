import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Split heavy/independent deps into their own chunks so the main
    // bundle stays small and cacheable. jspdf/html2canvas are already
    // lazy-loaded from pdfExport.ts, this keeps the vendor split clean.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react-vendor'
          if (id.includes('node_modules/tuvi-neo')) return 'tuvi'
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
})
