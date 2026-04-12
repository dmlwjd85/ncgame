/**
 * 마스터 전용: 다른 사용자 Firebase Auth 계정 삭제 + Firestore users·loginByName 정리
 * 배포: firebase deploy --only functions
 * 설정: firebase functions:config:set ncgame.master_email="마스터_로그인_이메일" ncgame.master_uid=""
 */
const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

const REGION = 'asia-northeast3'

exports.deleteNcgameUser = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.')
  }

  const cfg = functions.config().ncgame || {}
  const masterEmail = (cfg.master_email || '').trim()
  const masterUid = (cfg.master_uid || '').trim()

  const callerEmail = context.auth.token.email || ''
  const callerUid = context.auth.uid

  const isMaster =
    (masterEmail && callerEmail === masterEmail) ||
    (masterUid && callerUid === masterUid)

  if (!isMaster) {
    throw new functions.https.HttpsError('permission-denied', '마스터만 삭제할 수 있습니다.')
  }

  const targetUid = data?.targetUid
  if (!targetUid || typeof targetUid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'targetUid가 필요합니다.')
  }

  if (targetUid === callerUid) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      '본인 계정은 여기서 삭제할 수 없습니다.',
    )
  }

  if (masterEmail || masterUid) {
    try {
      const target = await admin.auth().getUser(targetUid)
      if (masterEmail && target.email === masterEmail) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          '마스터 계정은 삭제할 수 없습니다.',
        )
      }
      if (masterUid && targetUid === masterUid) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          '마스터 계정은 삭제할 수 없습니다.',
        )
      }
    } catch (e) {
      if (e instanceof functions.https.HttpsError) throw e
      if (e.code !== 'auth/user-not-found') throw e
    }
  }

  const db = admin.firestore()
  const userRef = db.doc(`users/${targetUid}`)
  const userSnap = await userRef.get()

  if (!userSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Firestore 사용자 문서가 없습니다.')
  }

  const displayName = userSnap.data()?.displayName
  if (displayName && typeof displayName === 'string' && displayName.trim()) {
    const dn = displayName.trim()
    await db.doc(`loginByName/${dn}`).delete().catch(() => {})
  }

  await userRef.delete().catch(() => {})

  try {
    await admin.auth().deleteUser(targetUid)
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e
  }

  return { ok: true }
})
