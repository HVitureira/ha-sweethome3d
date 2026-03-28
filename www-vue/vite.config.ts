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
    {
      // Serve the pre-built Unity WebGL app from /unity-visualizer/ in dev
      name: 'unity-visualizer-static',
      configureServer(server) {
        const unityBuildDir = path.resolve(__dirname, '../unity-build')
        server.middlewares.use((req, res, next) => {
          const urlPath = (req.url ?? '').split('?')[0]
          if (!urlPath.startsWith('/unity-visualizer/')) return next()

          const relativePath = urlPath.slice('/unity-visualizer/'.length)
          const filePath = path.join(unityBuildDir, relativePath)

          if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return next()

          const ext = path.extname(filePath).toLowerCase()
          const mimeMap: Record<string, string> = {
            '.html': 'text/html',
            '.js':   'application/javascript',
            '.css':  'text/css',
            '.wasm': 'application/wasm',
            '.json': 'application/json',
            '.png':  'image/png',
            '.ico':  'image/x-icon',
            '.svg':  'image/svg+xml',
          }
          res.setHeader('Content-Type', mimeMap[ext] ?? 'application/octet-stream')
          // Unity WebGL uses Brotli pre-compressed files (.wasm.br, .js.br, .data.br)
          if (ext === '.br') res.setHeader('Content-Encoding', 'br')
          fs.createReadStream(filePath).pipe(res)
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
