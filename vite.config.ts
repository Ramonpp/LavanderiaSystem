import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/lg-api': {
        target: 'https://api-aic.lgthinq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lg-api/, '')
      }
    }
  },
  // Evita herdar postcss.config.* do diretório pai do monorepo (ex.: tailwind não instalado neste projeto).
  css: {
    postcss: {
      plugins: [],
    },
  },
})
