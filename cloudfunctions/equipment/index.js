const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const equipmentCol = db.collection('equipment')
const users = db.collection('users')

// 判断是否是管理员（token 优先，其次 openid）
async function isAdmin(event) {
  const { OPENID } = cloud.getWXContext()
  if (event.token) {
    const res = await users.where({ token: event.token }).get()
    return res.data.length > 0 && res.data[0].isAdmin === true
  }
  if (OPENID) {
    const res = await users.where({ _openid: OPENID }).get()
    return res.data.length > 0 && res.data[0].isAdmin === true
  }
  return false
}

exports.main = async (event, context) => {
  const action = event.action || 'list'

  try {
    switch (action) {
      case 'list': {
        // 所有用户（含未登录）都可以查看器材列表
        const res = await equipmentCol.orderBy('createTime', 'desc').get()
        return { code: 0, list: res.data }
      }

      case 'detail': {
        const { id } = event
        if (!id) return { code: 1, message: '缺少器材 ID' }
        const res = await equipmentCol.doc(id).get()
        return { code: 0, item: res.data }
      }

      case 'add': {
        if (!(await isAdmin(event))) return { code: 2, message: '无权限：仅管理员可添加器材' }

        const name = (event.name || '').trim()
        if (!name) return { code: 1, message: '请填写器材名称' }

        if (event.code) {
          const dup = await equipmentCol.where({ code: event.code }).get()
          if (dup.data.length > 0) return { code: 1, message: '该编号已存在' }
        }

        const addRes = await equipmentCol.add({
          data: {
            name,
            category: event.category || '机身',
            code: (event.code || '').trim(),
            brand: (event.brand || '').trim(),
            imageFileID: event.imageFileID || '',
            remark: (event.remark || '').trim(),
            status: 'available',
            currentBorrower: '',
            currentBorrowerOpenid: '',
            currentBorrowerToken: '',
            currentReason: '',
            borrowTime: null,
            createTime: db.serverDate()
          }
        })
        return { code: 0, id: addRes._id, message: '添加成功' }
      }

      case 'update': {
        if (!(await isAdmin(event))) return { code: 2, message: '无权限：仅管理员可编辑器材' }

        const { id } = event
        if (!id) return { code: 1, message: '缺少器材 ID' }

        const updateData = {}
        if (event.name !== undefined) updateData.name = (event.name || '').trim()
        if (event.category !== undefined) updateData.category = event.category
        if (event.code !== undefined) updateData.code = (event.code || '').trim()
        if (event.brand !== undefined) updateData.brand = (event.brand || '').trim()
        if (event.imageFileID !== undefined) updateData.imageFileID = event.imageFileID
        if (event.remark !== undefined) updateData.remark = (event.remark || '').trim()

        if (updateData.code) {
          const dup = await equipmentCol.where({ code: updateData.code }).get()
          if (dup.data.length > 0 && dup.data[0]._id !== id) {
            return { code: 1, message: '该编号已存在' }
          }
        }

        await equipmentCol.doc(id).update({ data: updateData })
        return { code: 0, message: '修改成功' }
      }

      case 'delete': {
        if (!(await isAdmin(event))) return { code: 2, message: '无权限：仅管理员可删除器材' }

        const { id } = event
        if (!id) return { code: 1, message: '缺少器材 ID' }
        await equipmentCol.doc(id).remove()
        return { code: 0, message: '删除成功' }
      }

      default:
        return { code: 1, message: '未知操作' }
    }
  } catch (err) {
    console.error(err)
    return { code: 1, message: '服务异常', error: err.message }
  }
}
