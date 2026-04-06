import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import * as fs from 'node:fs'
import * as path from 'node:path'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    {
      // In dev mode, serve /data/* and PHP endpoints directly from test-data/
      // so SH3D works without Docker running.
      name: 'sh3d-dev-backend',
      configureServer(server) {
        const dataDir = path.resolve(__dirname, '../test-data')

        server.middlewares.use((req, res, next) => {
          const urlPath = (req.url ?? '').split('?')[0]

          // --- listHomes.php: scan test-data/ for .sh3x files ---
          if (urlPath === '/listHomes.php') {
            res.setHeader('Content-Type', 'application/json')
            if (!fs.existsSync(dataDir)) { res.end('[]'); return }
            const homes = fs.readdirSync(dataDir)
              .filter(f => f.endsWith('.sh3x'))
              .map(f => f.slice(0, -5)) // strip .sh3x
            res.end(JSON.stringify(homes))
            return
          }

          // --- writeData.php: write to test-data/ ---
          if (urlPath === '/writeData.php') {
            const urlObj = new URL(req.url!, `http://${req.headers.host}`)
            const filePath = urlObj.searchParams.get('path')
            if (!filePath) { res.statusCode = 400; res.end('Missing path'); return }
            const absPath = path.join(dataDir, filePath)
            const dir = path.dirname(absPath)
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
            const chunks: Buffer[] = []
            req.on('data', (chunk: Buffer) => chunks.push(chunk))
            req.on('end', () => {
              fs.writeFileSync(absPath, Buffer.concat(chunks))
              res.statusCode = 200
              res.end()
            })
            return
          }

          // --- deleteHome.php: delete from test-data/ ---
          if (urlPath === '/deleteHome.php') {
            const urlObj = new URL(req.url!, `http://${req.headers.host}`)
            const homeId = urlObj.searchParams.get('home')
            if (homeId) {
              for (const ext of ['.sh3x', '_devices.json', '_geometry.zip']) {
                const f = path.join(dataDir, homeId + ext)
                if (fs.existsSync(f)) fs.unlinkSync(f)
              }
            }
            res.statusCode = 200
            res.end()
            return
          }

          // --- /data/*: serve from test-data/ ---
          if (urlPath.startsWith('/data/')) {
            const filePath = path.join(dataDir, urlPath.slice('/data/'.length))

            if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
              const ext = path.extname(filePath).toLowerCase()
              const mimeMap: Record<string, string> = {
                '.json': 'application/json',
                '.sh3x': 'application/octet-stream',
                '.zip': 'application/zip',
              }
              res.setHeader('Content-Type', mimeMap[ext] ?? 'application/octet-stream')
              fs.createReadStream(filePath).pipe(res)
              return
            }

            // Missing .json → return empty object (SH3D expects valid JSON for prefs)
            if (urlPath.endsWith('.json')) {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end('{}')
              return
            }

            res.statusCode = 404
            res.end()
            return
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
    // PHP endpoints are handled by the sh3d-dev-backend middleware above
    // (reads/writes directly to test-data/, no Docker needed for dev)
  },
  build: {
    assetsInlineLimit: 0,
    copyPublicDir: false,
  },
})
