/**
 * Vite base 경로(GitHub Pages 등)를 반영한 정적 자산 URL
 * @param {string} path - 슬래시 없이 또는 있어도 됨 (예: ncxlxs/manifest.json)
 */
export function publicUrl(path) {
  const base = import.meta.env.BASE_URL || '/'
  const p = path.replace(/^\//, '')
  return `${base}${p}`.replace(/([^:]\/)\/+/g, '$1')
}
