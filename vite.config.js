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

  return {
    base,
    plugins: [react(), tailwindcss(), ncxlxsPlugin({ base })],
  }
})
