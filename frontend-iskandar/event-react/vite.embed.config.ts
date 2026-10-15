import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Builds the custom elements (<tilted-grid-hero>, <halftone-wordmark-footer>) as
// one script + one stylesheet for the plain-HTML TiketKita site. Run
// `npm run build:embed`; the files land in ../embeds/ (event-frontend/embeds/).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // Library builds do not replace this, and React reads it in the browser.
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: '../embeds',
    // Only ever overwrite the two output files, never clear a folder that
    // sits inside the website.
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/embed/index.ts'),
      formats: ['iife'],
      name: 'TiketKitaEmbeds',
      fileName: () => 'tiketkita-embeds.js',
      cssFileName: 'tiketkita-embeds',
    },
  },
})
