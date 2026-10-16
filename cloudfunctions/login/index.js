const cloud = require('wx-server-sdk')
const crypto = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const users = db.collection('users')

const SALT = 'camera-equipment-manager-salt'

function hashPassword(name, password) {
  return crypto.createHash('sha256').update(name + ':' + password + ':' + SALT).digest('hex')
}

function genToken() {
  return crypto.randomBytes(24).toString('hex')
}

function cleanUser(user) {
  return {
    _id: user._id,
    _openid: user._openid || '',
    name: user.name,
    isAdmin: user.isAdmin === true,
    avatarFileID: user.avatarFileID || ''
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action || 'login'

  try {
    switch (action) {
      // ---------- 小程序：静默登录 ----------
      case 'login': {
        if (!OPENID) return { code: 1, message: '无法获取微信身份' }
        const res = await users.where({ _openid: OPENID }).get()
        if (res.data.length === 0) return { code: 0, isNew: true }
        return { code: 0, isNew: false, userInfo: cleanUser(res.data[0]) }
      }

      // ---------- 小程序：注册 ----------
      case 'register': {
        if (!OPENID) return { code: 1, message: '无法获取微信身份' }
        const name = (event.name || '').trim()
        if (!name) return { code: 1, message: '请填写姓名' }

        const exist = await users.where({ _openid: OPENID }).get()
        if (exist.data.length > 0) {
          return { code: 1, message: '该微信已注册', userInfo: cleanUser(exist.data[0]) }
        }

        const countRes = await users.count()
        const isAdmin = countRes.total === 0

        const addRes = await users.add({
          data: {
            _openid: OPENID,
            name,
            isAdmin,
            avatarFileID: '',
            passwordHash: '',
            token: '',
            createTime: db.serverDate()
          }
        })
        return {
          code: 0,
          isNew: false,
          userInfo: { _id: addRes._id, _openid: OPENID, name, isAdmin, avatarFileID: '' }
        }
      }

      // ---------- 网页：注册 ----------
      case 'webRegister': {
        const name = (event.name || '').trim()
        const password = event.password || ''
        if (!name) return { code: 1, message: '请填写姓名' }
        if (!password || password.length < 4) return { code: 1, message: '密码至少 4 位' }

        const passwordHash = hashPassword(name, password)
        const token = genToken()

        const exist = await users.where({ name }).get()

        if (exist.data.length > 0) {
          const old = exist.data[0]
          if (old.passwordHash) {
            return { code: 1, message: '该姓名已被注册，请直接登录' }
          }
          // 接管小程序旧记录，保留 isAdmin
          await users.doc(old._id).update({ data: { passwordHash, token } })
          return {
            code: 0, token,
            userInfo: { _id: old._id, name, isAdmin: old.isAdmin === true, avatarFileID: old.avatarFileID || '' }
          }
        }

        const countRes = await users.count()
        const isAdmin = countRes.total === 0

        const addRes = await users.add({
          data: {
            name,
            passwordHash,
            token,
            isAdmin,
            avatarFileID: '',
            createTime: db.serverDate()
          }
        })
        return { code: 0, token, userInfo: { _id: addRes._id, name, isAdmin, avatarFileID: '' } }
      }

      // ---------- 网页：登录 ----------
      case 'webLogin': {
        const name = (event.name || '').trim()
        const password = event.password || ''
        if (!name || !password) return { code: 1, message: '请填写姓名和密码' }

        const passwordHash = hashPassword(name, password)
        const res = await users.where({ name, passwordHash }).get()
        if (res.data.length === 0) return { code: 1, message: '姓名或密码错误' }

        const user = res.data[0]
        const token = genToken()
        await users.doc(user._id).update({ data: { token } })
        return { code: 0, token, userInfo: cleanUser(user) }
      }

      // ---------- 网页：token 验证 ----------
      case 'getByToken': {
        const { token } = event
        if (!token) return { code: 2, message: '未登录' }
        const res = await users.where({ token }).get()
        if (res.data.length === 0) return { code: 2, message: '登录已过期，请重新登录' }
        return { code: 0, userInfo: cleanUser(res.data[0]) }
      }

      // ---------- 更新资料（token 或 openid）----------
      case 'updateProfile': {
        let user = null
        if (event.token) {
          const res = await users.where({ token: event.token }).get()
          user = res.data.length > 0 ? res.data[0] : null
        } else if (OPENID) {
          const res = await users.where({ _openid: OPENID }).get()
          user = res.data.length > 0 ? res.data[0] : null
        }
        if (!user) return { code: 2, message: '未登录' }

        const updateData = {}
        if (event.name !== undefined) {
          const n = (event.name || '').trim()
          if (!n) return { code: 1, message: '请填写姓名' }
          updateData.name = n
        }
        if (event.avatarFileID !== undefined) updateData.avatarFileID = event.avatarFileID
        if (Object.keys(updateData).length > 0) {
          await users.doc(user._id).update({ data: updateData })
        }

        return {
          code: 0,
          userInfo: {
            _id: user._id,
            _openid: user._openid || '',
            name: updateData.name || user.name,
            isAdmin: user.isAdmin === true,
            avatarFileID: updateData.avatarFileID !== undefined ? updateData.avatarFileID : (user.avatarFileID || '')
          }
        }
      }

      // ---------- 网页：退出 ----------
      case 'logout': {
        const { token } = event
        if (token) {
          const res = await users.where({ token }).get()
          if (res.data.length > 0) await users.doc(res.data[0]._id).update({ data: { token: '' } })
        }
        return { code: 0 }
      }

      default:
        return { code: 1, message: '未知操作' }
    }
  } catch (err) {
    console.error(err)
    return { code: 1, message: '服务异常', error: err.message }
  }
}
