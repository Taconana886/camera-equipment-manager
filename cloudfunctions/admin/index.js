const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const users = db.collection('users')

// 获取当前用户（网页 token 优先，其次小程序 openid）
async function getCurrentUser(event) {
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
  const action = event.action || 'listUsers'

  try {
    const user = await getCurrentUser(event)
    if (!user || user.isAdmin !== true) {
      return { code: 2, message: '无权限：仅管理员可操作' }
    }

    switch (action) {
      case 'listUsers': {
        const res = await users.orderBy('createTime', 'asc').get()
        const list = res.data.map(u => ({
          _id: u._id,
          name: u.name,
          isAdmin: u.isAdmin === true,
          avatarFileID: u.avatarFileID || '',
          createTime: u.createTime
        }))
        return { code: 0, list }
      }

      case 'setAdmin': {
        const { userId, isAdmin: target } = event
        if (!userId) return { code: 1, message: '缺少用户 ID' }

        // 不能取消自己的管理员权限
        if (user._id === userId && !target) {
          return { code: 1, message: '不能取消自己的管理员权限' }
        }

        await users.doc(userId).update({ data: { isAdmin: target === true } })
        return { code: 0, message: target ? '已设为管理员' : '已取消管理员' }
      }

      case 'deleteUser': {
        const { userId } = event
        if (!userId) return { code: 1, message: '缺少用户 ID' }

        // 不能删除自己
        if (user._id === userId) {
          return { code: 1, message: '不能移除自己' }
        }

        await users.doc(userId).remove()
        return { code: 0, message: '已移除该用户' }
      }

      default:
        return { code: 1, message: '未知操作' }
    }
  } catch (err) {
    console.error(err)
    return { code: 1, message: '服务异常', error: err.message }
  }
}
