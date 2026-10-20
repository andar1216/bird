import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built app also loads from file:// in Electron.
  base: './',
  server: { port: 5173, strictPort: true },
})
