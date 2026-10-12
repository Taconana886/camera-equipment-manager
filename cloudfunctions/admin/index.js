const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const users = db.collection('users')

// 判断是否是管理员
async function isAdmin(openid) {
  const res = await users.where({ _openid: openid }).get()
  return res.data.length > 0 && res.data[0].isAdmin === true
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action || 'listUsers'

  try {
    // 所有操作均需管理员权限
    if (!(await isAdmin(OPENID))) {
      return { code: 2, message: '无权限：仅管理员可操作' }
    }

    switch (action) {
      case 'listUsers': {
        const res = await users.orderBy('createTime', 'asc').get()
        return { code: 0, list: res.data }
      }

      case 'setAdmin': {
        const { userId, isAdmin: target } = event
        if (!userId) return { code: 1, message: '缺少用户 ID' }

        // 不能取消自己的管理员权限
        const selfRes = await users.where({ _openid: OPENID }).get()
        if (selfRes.data.length > 0 && selfRes.data[0]._id === userId && !target) {
          return { code: 1, message: '不能取消自己的管理员权限' }
        }

        await users.doc(userId).update({ data: { isAdmin: target === true } })
        return { code: 0, message: target ? '已设为管理员' : '已取消管理员' }
      }

      default:
        return { code: 1, message: '未知操作' }
    }
  } catch (err) {
    console.error(err)
    return { code: 1, message: '服务异常', error: err.message }
  }
}
