import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: '@/app', replacement: path.resolve(__dirname, 'src/app') },
      { find: '@/features', replacement: path.resolve(__dirname, 'src/features') },
      { find: '@/shared', replacement: path.resolve(__dirname, 'src/shared') },
      { find: '@/assets', replacement: path.resolve(__dirname, 'src/assets') },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: {
    port: 5173,
    strictPort: true,
    open: true,
  },
})
