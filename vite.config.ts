import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/exceljs')) return 'excel-import'
          if (id.includes('src/features/csv-import') || id.includes('src/lib/csv/spreadsheet')) return 'csv-import'
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
