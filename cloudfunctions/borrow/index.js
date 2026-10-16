const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const equipmentCol = db.collection('equipment')
const recordsCol = db.collection('borrow_records')
const users = db.collection('users')

// 获取用户（网页 token 优先，其次小程序 openid）
async function getUser(event) {
  const { OPENID } = cloud.getWXContext()
  if (event.token) {
    const res = await users.where({ token: event.token }).get()
    return res.data.length > 0 ? res.data[0] : null
  }
  if (OPENID) {
    const res = await users.where({ _openid: OPENID }).get()
    return res.data.length > 0 ? res.data[0] : null
  }
  return null
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action || 'records'
  const token = event.token || ''
  const isWeb = !!token // 网页版一定有 token，小程序没有

  try {
    switch (action) {
      case 'borrow': {
        const user = await getUser(event)
        if (!user) return { code: 2, message: '请先登录' }

        const { id } = event
        if (!id) return { code: 1, message: '缺少器材 ID' }

        const eqRes = await equipmentCol.doc(id).get().catch(() => null)
        if (!eqRes || !eqRes.data) return { code: 1, message: '器材不存在' }
        const eq = eqRes.data
        if (eq.status === 'borrowed') {
          return { code: 1, message: `该器材已被 ${eq.currentBorrower || '他人'} 借走` }
        }

        const now = db.serverDate()
        const reason = (event.reason || '').trim()
        await equipmentCol.doc(id).update({
          data: {
            status: 'borrowed',
            currentBorrower: user.name,
            currentBorrowerOpenid: isWeb ? '' : OPENID,
            currentBorrowerToken: isWeb ? token : '',
            borrowTime: now,
            currentReason: reason
          }
        })

        await recordsCol.add({
          data: {
            equipmentId: id,
            equipmentName: eq.name,
            equipmentCode: eq.code || '',
            borrowerName: user.name,
            borrowerOpenid: isWeb ? '' : OPENID,
            borrowerToken: isWeb ? token : '',
            borrowTime: now,
            reason,
            returnTime: null,
            returnImageFileID: '',
            status: 'borrowed'
          }
        })

        return { code: 0, message: '借用成功' }
      }

      case 'return': {
        const user = await getUser(event)
        if (!user) return { code: 2, message: '请先登录' }

        const { id } = event
        if (!id) return { code: 1, message: '缺少器材 ID' }

        const eqRes = await equipmentCol.doc(id).get().catch(() => null)
        if (!eqRes || !eqRes.data) return { code: 1, message: '器材不存在' }
        const eq = eqRes.data

        if (eq.status === 'available') {
          return { code: 1, message: '该器材已在器材室，无需归还' }
        }

        // 借用人本人（网页 token 或小程序 openid）或管理员
        const isBorrower = isWeb
          ? eq.currentBorrowerToken === token
          : eq.currentBorrowerOpenid === OPENID
        const isAdminUser = user.isAdmin === true
        if (!isBorrower && !isAdminUser) {
          return { code: 2, message: '只能由借用人本人或管理员归还' }
        }

        const now = db.serverDate()
        await equipmentCol.doc(id).update({
          data: {
            status: 'available',
            currentBorrower: '',
            currentBorrowerOpenid: '',
            currentBorrowerToken: '',
            borrowTime: null,
            currentReason: ''
          }
        })

        const recRes = await recordsCol.where({
          equipmentId: id,
          status: 'borrowed'
        }).orderBy('borrowTime', 'desc').limit(1).get()

        if (recRes.data.length > 0) {
          await recordsCol.doc(recRes.data[0]._id).update({
            data: {
              status: 'returned',
              returnTime: now,
              returnImageFileID: event.returnImageFileID || ''
            }
          })
        }

        return { code: 0, message: '归还成功' }
      }

      case 'records': {
        const user = await getUser(event)
        if (!user) return { code: 2, message: '请先登录' }

        let res
        if (user.isAdmin === true) {
          res = await recordsCol.orderBy('borrowTime', 'desc').limit(100).get()
        } else if (isWeb) {
          res = await recordsCol.where({ borrowerToken: token }).orderBy('borrowTime', 'desc').limit(100).get()
        } else {
          res = await recordsCol.where({ borrowerOpenid: OPENID }).orderBy('borrowTime', 'desc').limit(100).get()
        }
        return { code: 0, list: res.data }
      }

      default:
        return { code: 1, message: '未知操作' }
    }
  } catch (err) {
    console.error(err)
    return { code: 1, message: '服务异常', error: err.message }
  }
}
