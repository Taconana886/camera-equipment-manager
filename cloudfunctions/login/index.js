const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const users = db.collection('users')

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action || 'login'

  try {
    switch (action) {
      case 'login': {
        // 根据 openid 查询用户
        const res = await users.where({ _openid: OPENID }).get()
        if (res.data.length === 0) {
          return { code: 0, isNew: true, message: '未注册' }
        }
        return { code: 0, isNew: false, userInfo: res.data[0] }
      }

      case 'register': {
        const name = (event.name || '').trim()
        if (!name) {
          return { code: 1, message: '请填写姓名' }
        }

        // 检查是否已注册
        const exist = await users.where({ _openid: OPENID }).get()
        if (exist.data.length > 0) {
          return { code: 1, message: '该微信已注册', userInfo: exist.data[0] }
        }

        // 首个注册用户自动成为管理员
        const countRes = await users.count()
        const isAdmin = countRes.total === 0

        const addRes = await users.add({
          data: {
            _openid: OPENID,
            name,
            avatarFileID: event.avatarFileID || '',
            isAdmin,
            createTime: db.serverDate()
          }
        })

        return {
          code: 0,
          isNew: false,
          userInfo: {
            _id: addRes._id,
            _openid: OPENID,
            name,
            avatarFileID: event.avatarFileID || '',
            isAdmin
          }
        }
      }

      case 'updateProfile': {
        const exist = await users.where({ _openid: OPENID }).get()
        if (exist.data.length === 0) {
          return { code: 1, message: '用户不存在' }
        }

        const updateData = {}
        if (event.name !== undefined) {
          const name = (event.name || '').trim()
          if (!name) return { code: 1, message: '请填写姓名' }
          updateData.name = name
        }
        if (event.avatarFileID !== undefined) {
          updateData.avatarFileID = event.avatarFileID
        }
        if (Object.keys(updateData).length === 0) {
          return { code: 1, message: '没有要更新的内容' }
        }

        await users.doc(exist.data[0]._id).update({ data: updateData })
        return { code: 0, userInfo: { ...exist.data[0], ...updateData } }
      }

      default:
        return { code: 1, message: '未知操作' }
    }
  } catch (err) {
    console.error(err)
    return { code: 1, message: '服务异常', error: err.message }
  }
}
