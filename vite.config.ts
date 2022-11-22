import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: "lib/ui",
    lib: {
      entry: './ui/main.ts',
      name: "ui",
      fileName: (f) => `ui.${f}.js`
    }
  },
  define: {
    "process.env": {},
  },
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./ui/src', import.meta.url))
    }
  }
})
