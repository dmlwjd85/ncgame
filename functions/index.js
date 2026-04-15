/**
 * 마스터 전용: 사용자 삭제(Auth·Firestore·loginByName)
 * 포인트 지급/차감은 클라이언트+Firestore 규칙(ncgame 마스터만 타인 users 문서 수정)으로 처리합니다.
 * 배포: firebase deploy --only functions (Blaze 필요)
 * 설정: firebase functions:config:set ncgame.master_email="..." ncgame.master_uid=""
 */
const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

const REGION = 'asia-northeast3'

/**
 * @param {import('firebase-functions').https.CallableContext} context
 */
function assertMaster(context) {
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
    throw new functions.https.HttpsError('permission-denied', '마스터만 사용할 수 있습니다.')
  }
  return { callerUid, callerEmail, masterEmail, masterUid }
}

exports.deleteNcgameUser = functions.region(REGION).https.onCall(async (data, context) => {
  assertMaster(context)

  const targetUid = data?.targetUid
  if (!targetUid || typeof targetUid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'targetUid가 필요합니다.')
  }

  const callerUid = context.auth.uid

  if (targetUid === callerUid) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      '본인 계정은 여기서 삭제할 수 없습니다.',
    )
  }

  const cfg = functions.config().ncgame || {}
  const masterEmail = (cfg.master_email || '').trim()
  const masterUid = (cfg.master_uid || '').trim()

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

  if (userSnap.exists) {
    const displayName = userSnap.data()?.displayName
    if (displayName && typeof displayName === 'string' && displayName.trim()) {
      const dn = displayName.trim()
      await db.doc(`loginByName/${dn}`).delete().catch(() => {})
    }
    await userRef.delete().catch(() => {})
  }

  try {
    await admin.auth().deleteUser(targetUid)
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e
  }

  return { ok: true, hadUserDoc: userSnap.exists }
})
