/**
 * 포인트 0인 계정 일괄 삭제(관리자용).
 *
 * - Firestore `users/{uid}` 문서의 points === 0 인 사용자만 대상으로 합니다.
 * - 대상 UID에 대해:
 *   - users/{uid} 삭제
 *   - (있으면) loginByName/{displayName} 삭제
 *   - Firebase Auth 사용자 삭제
 *
 * 실행(택1):
 * 1) GOOGLE_APPLICATION_CREDENTIALS=서비스계정.json
 *    node scripts/admin-delete-zero-point-users.mjs --limit=200
 *
 * 2) FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
 *    node scripts/admin-delete-zero-point-users.mjs --limit=200
 *
 * 옵션:
 *  --limit=200   : 한 번에 처리할 최대 수(기본 200)
 *  --dry         : 실제 삭제 없이 대상만 출력
 */
import admin from 'firebase-admin'

function parseArgs() {
  const args = process.argv.slice(2)
  const out = { limit: 200, dry: false }
  for (const a of args) {
    if (a === '--dry') out.dry = true
    if (a.startsWith('--limit=')) out.limit = Math.max(1, Number(a.split('=')[1]) || 200)
  }
  return out
}

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (raw && raw.trim().startsWith('{')) {
    const json = JSON.parse(raw)
    admin.initializeApp({ credential: admin.credential.cert(json) })
    return
  }
  // GOOGLE_APPLICATION_CREDENTIALS 사용(ADC)
  admin.initializeApp()
}

async function main() {
  const { limit, dry } = parseArgs()
  initAdmin()

  const db = admin.firestore()
  const q = await db.collection('users').where('points', '==', 0).limit(limit).get()
  console.log(`대상 users 문서: ${q.size}개 (points == 0)`)

  if (q.empty) return

  let ok = 0
  let fail = 0

  for (const doc of q.docs) {
    const uid = doc.id
    const d = doc.data() || {}
    const displayName = typeof d.displayName === 'string' ? d.displayName.trim() : ''
    console.log('-', uid, displayName ? `(displayName: ${displayName})` : '')

    if (dry) continue

    try {
      if (displayName) {
        await db.doc(`loginByName/${displayName}`).delete().catch(() => {})
      }
      await db.doc(`users/${uid}`).delete().catch(() => {})
      await admin.auth().deleteUser(uid).catch((e) => {
        if (e?.code !== 'auth/user-not-found') throw e
      })
      ok += 1
    } catch (e) {
      fail += 1
      console.error('  삭제 실패:', uid, e?.message ?? e)
    }
  }

  console.log(`완료: 성공 ${ok} / 실패 ${fail} / dry=${dry}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

