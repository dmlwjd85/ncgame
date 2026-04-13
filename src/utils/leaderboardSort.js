/**
 * 명예의 전당 정렬: 최고 레벨 내림차순, 동률이면 달성 시각 오름차순(먼저 기록한 사람 우선)
 * @param {Array<{ maxLevel?: number, achievedAt?: string, updatedAt?: unknown }>} rows
 * @returns {typeof rows}
 */
export function sortLeaderboardRows(rows) {
  return [...rows].sort((a, b) => {
    const ma = Number(a.maxLevel) || 0
    const mb = Number(b.maxLevel) || 0
    if (mb !== ma) return mb - ma
    return rowAchievedTimeMs(a) - rowAchievedTimeMs(b)
  })
}

/**
 * @param {{ achievedAt?: string, updatedAt?: unknown }} row
 */
function rowAchievedTimeMs(row) {
  const raw = row.achievedAt ?? row.updatedAt
  if (typeof raw === 'string') {
    const t = Date.parse(raw)
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER
  }
  if (raw && typeof raw.toDate === 'function') {
    return raw.toDate().getTime()
  }
  return Number.MAX_SAFE_INTEGER
}
