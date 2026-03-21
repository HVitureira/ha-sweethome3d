import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import * as fs from 'node:fs'
import * as path from 'node:path'

const phpTarget = process.env.VITE_PHP_TARGET ?? 'http://localhost:8099'

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'sh3d-missing-data-json',
      configureServer(server) {
        const wwwDir = path.resolve(__dirname, '../sweethome3d/www')
        server.middlewares.use((req, res, next) => {
          const urlPath = (req.url ?? '').split('?')[0]
          if (urlPath.startsWith('/data/') && urlPath.endsWith('.json')) {
            const absPath = path.join(wwwDir, urlPath)
            if (!fs.existsSync(absPath)) {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end('{}')
              return
            }
          }
          next()
        })
      },
    },
  ],
  publicDir: '../sweethome3d/www',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/listHomes.php': { target: phpTarget, changeOrigin: true },
      '/readData.php': { target: phpTarget, changeOrigin: true },
      '/writeData.php': { target: phpTarget, changeOrigin: true },
      '/deleteHome.php': { target: phpTarget, changeOrigin: true },
      '/exportForUnity.php': { target: phpTarget, changeOrigin: true },
    },
  },
  build: {
    assetsInlineLimit: 0,
    copyPublicDir: false,
  },
})
