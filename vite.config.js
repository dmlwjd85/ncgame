import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { ncxlxsPlugin } from './vite-plugins/ncxlxsPlugin.js'

// GitHub Pages(…/저장소이름/)는 하위 경로 배포 → VITE_BASE_PATH=/ncgame/ 등으로 설정
// Firebase Hosting(루트)는 기본값 '/' 유지
// https://vite.dev/config/shared-options.html#base
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let base = env.VITE_BASE_PATH || '/'
  if (!base.startsWith('/')) base = `/${base}`
  if (!base.endsWith('/')) base = `${base}/`

  /** GitHub Pages는 /repo/login 같은 경로에 파일이 없으면 404를 보냄. 404.html을 index와 동일하게 두면 SPA가 로드됨 */
  const githubPagesSpa404 = {
    name: 'github-pages-spa-404',
    closeBundle() {
      const root = join(process.cwd(), 'dist')
      const indexHtml = join(root, 'index.html')
      if (!existsSync(indexHtml)) return
      copyFileSync(indexHtml, join(root, '404.html'))
    },
  }

  return {
    base,
    plugins: [react(), tailwindcss(), ncxlxsPlugin({ base }), githubPagesSpa404],
  }
})
