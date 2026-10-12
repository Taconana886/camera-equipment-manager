const app = getApp()
const { formatTime } = require('../../utils/util')

Page({
  data: {
    isAdmin: false,
    tab: 'equipment',
    equipmentList: [],
    userList: [],
    recordList: [],
    loading: false,
    showForm: false,
    formMode: 'add', // add / edit
    form: {
      id: '',
      name: '',
      code: '',
      brand: '',
      remark: '',
      imageFileID: ''
    },
    submitting: false
  },

  onLoad() {
    const userInfo = wx.getStorageSync('userInfo')
    const isAdmin = userInfo && userInfo.isAdmin === true
    if (!isAdmin) {
      wx.showToast({ title: '无权限访问', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1200)
      return
    }
    this.setData({ isAdmin })
  },

  onShow() {
    if (this.data.isAdmin) {
      this.loadEquipment()
      this.loadUsers()
      this.loadRecords()
    }
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
  },

  async loadRecords() {
    try {
      const res = await wx.cloud.callFunction({ name: 'borrow', data: { action: 'records' } })
      const result = res.result || {}
      if (result.code === 0) {
        const list = (result.list || []).map(r => ({
          ...r,
          borrowTimeText: r.borrowTime ? formatTime(r.borrowTime) : '',
          returnTimeText: r.returnTime ? formatTime(r.returnTime) : ''
        }))
        this.setData({ recordList: list })
      }
    } catch (e) {
      console.error(e)
    }
  },

  async loadEquipment() {
    try {
      const res = await wx.cloud.callFunction({ name: 'equipment', data: { action: 'list' } })
      const result = res.result || {}
      if (result.code === 0) this.setData({ equipmentList: result.list || [] })
    } catch (e) {
      console.error(e)
    }
  },

  async loadUsers() {
    try {
      const res = await wx.cloud.callFunction({ name: 'admin', data: { action: 'listUsers' } })
      const result = res.result || {}
      if (result.code === 0) this.setData({ userList: result.list || [] })
      else wx.showToast({ title: result.message || '加载失败', icon: 'none' })
    } catch (e) {
      console.error(e)
    }
  },

  openAdd() {
    this.setData({
      showForm: true,
      formMode: 'add',
      form: { id: '', name: '', code: '', brand: '', remark: '', imageFileID: '' }
    })
  },

  openEdit(e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      showForm: true,
      formMode: 'edit',
      form: {
        id: item._id,
        name: item.name,
        code: item.code || '',
        brand: item.brand || '',
        remark: item.remark || '',
        imageFileID: item.imageFileID || ''
      }
    })
  },

  closeForm() {
    this.setData({ showForm: false })
  },

  noop() {},

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFilePaths[0]
        wx.showLoading({ title: '上传中...' })
        const ext = tempPath.split('.').pop() || 'jpg'
        wx.cloud.uploadFile({
          cloudPath: `equipment/${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`,
          filePath: tempPath,
          success: (uploadRes) => {
            this.setData({ 'form.imageFileID': uploadRes.fileID })
            wx.hideLoading()
          },
          fail: () => {
            wx.hideLoading()
            wx.showToast({ title: '上传失败', icon: 'none' })
          }
        })
      }
    })
  },

  removeImage() {
    this.setData({ 'form.imageFileID': '' })
  },

  async submitForm() {
    const form = this.data.form
    if (!form.name.trim()) {
      wx.showToast({ title: '请填写器材名称', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      let res
      if (this.data.formMode === 'add') {
        res = await wx.cloud.callFunction({
          name: 'equipment',
          data: {
            action: 'add',
            name: form.name,
            code: form.code,
            brand: form.brand,
            remark: form.remark,
            imageFileID: form.imageFileID
          }
        })
      } else {
        res = await wx.cloud.callFunction({
          name: 'equipment',
          data: {
            action: 'update',
            id: form.id,
            name: form.name,
            code: form.code,
            brand: form.brand,
            remark: form.remark,
            imageFileID: form.imageFileID
          }
        })
      }
      const result = res.result || {}
      if (result.code === 0) {
        wx.showToast({ title: this.data.formMode === 'add' ? '添加成功' : '修改成功', icon: 'success' })
        this.setData({ showForm: false })
        this.loadEquipment()
      } else {
        wx.showToast({ title: result.message || '操作失败', icon: 'none' })
      }
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '网络异常', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  deleteEquipment(e) {
    const item = e.currentTarget.dataset.item
    wx.showModal({
      title: '删除器材',
      content: `确定删除「${item.name}」吗？此操作不可恢复。`,
      confirmColor: '#e05353',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const call = await wx.cloud.callFunction({
            name: 'equipment',
            data: { action: 'delete', id: item._id }
          })
          const result = call.result || {}
          if (result.code === 0) {
            wx.showToast({ title: '删除成功', icon: 'success' })
            this.loadEquipment()
          } else {
            wx.showToast({ title: result.message || '删除失败', icon: 'none' })
          }
        } catch (e) {
          wx.showToast({ title: '网络异常', icon: 'none' })
        }
      }
    })
  },

  toggleAdmin(e) {
    const item = e.currentTarget.dataset.item
    const target = !(item.isAdmin === true)
    wx.showModal({
      title: target ? '设为管理员' : '取消管理员',
      content: target ? `确定将「${item.name}」设为管理员吗？` : `确定取消「${item.name}」的管理员权限吗？`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          const call = await wx.cloud.callFunction({
            name: 'admin',
            data: { action: 'setAdmin', userId: item._id, isAdmin: target }
          })
          const result = call.result || {}
          if (result.code === 0) {
            wx.showToast({ title: result.message, icon: 'success' })
            this.loadUsers()
          } else {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' })
          }
        } catch (e) {
          wx.showToast({ title: '网络异常', icon: 'none' })
        }
      }
    })
  }
})
