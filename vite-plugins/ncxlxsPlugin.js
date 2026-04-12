import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'fs'
import { join, resolve } from 'path'

/**
 * 프로젝트 루트의 ncxlxs 폴더를 개발 서버와 dist에 노출합니다.
 * @param {{ base: string }} opts — Vite base (예: / 또는 /ncgame/)
 */
export function ncxlxsPlugin({ base }) {
  const ncxlxsRoot = resolve(process.cwd(), 'ncxlxs')
  const baseNoSlash = (base || '/').replace(/\/$/, '')
  const urlPrefix = `${baseNoSlash}/ncxlxs`.replace(/\/+/g, '/')

  function mimeFor(file) {
    const ext = file.split('.').pop()?.toLowerCase()
    if (ext === 'json') return 'application/json; charset=utf-8'
    if (ext === 'xlsx')
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    if (ext === 'md' || ext === 'txt') return 'text/plain; charset=utf-8'
    return 'application/octet-stream'
  }

  return {
    name: 'ncxlxs-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        if (!url.startsWith(urlPrefix)) return next()
        const rel = decodeURIComponent(
          url.slice(urlPrefix.length).replace(/^\//, ''),
        )
        if (!rel || rel.includes('..')) return next()
        const filePath = join(ncxlxsRoot, rel)
        if (!filePath.startsWith(ncxlxsRoot)) return next()
        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          return next()
        }
        res.setHeader('Content-Type', mimeFor(rel))
        res.end(readFileSync(filePath))
      })
    },
    writeBundle() {
      if (!existsSync(ncxlxsRoot)) return
      const outDir = resolve(process.cwd(), 'dist/ncxlxs')
      mkdirSync(outDir, { recursive: true })
      function copyRecursive(src, dest) {
        for (const name of readdirSync(src)) {
          const s = join(src, name)
          const d = join(dest, name)
          if (statSync(s).isDirectory()) {
            mkdirSync(d, { recursive: true })
            copyRecursive(s, d)
          } else {
            copyFileSync(s, d)
          }
        }
      }
      copyRecursive(ncxlxsRoot, outDir)
    },
  }
}
