const app = getApp()
const { formatTime } = require('../../utils/util')

Page({
  data: {
    id: '',
    item: null,
    userInfo: null,
    isAdmin: false,
    isBorrower: false,
    loading: true,
    operating: false
  },

  onLoad(options) {
    this.setData({ id: options.id || '' })
    const userInfo = wx.getStorageSync('userInfo')
    this.setData({
      userInfo,
      isAdmin: userInfo && userInfo.isAdmin === true
    })
    if (this.data.id) this.loadDetail()
  },

  async loadDetail() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: { action: 'detail', id: this.data.id }
      })
      const result = res.result || {}
      if (result.code === 0 && result.item) {
        const item = result.item
        const userInfo = this.data.userInfo
        this.setData({
          item: {
            ...item,
            borrowTimeText: item.borrowTime ? formatTime(item.borrowTime) : ''
          },
          isBorrower: item.currentBorrowerOpenid && userInfo && item.currentBorrowerOpenid === userInfo.openid
        })
      } else {
        wx.showToast({ title: result.message || '加载失败', icon: 'none' })
      }
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '网络异常', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  previewImage() {
    const url = this.data.item && this.data.item.imageFileID
    if (url) wx.previewImage({ urls: [url] })
  },

  requireLogin() {
    if (this.data.userInfo) return true
    wx.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 500)
    return false
  },

  onBorrow() {
    if (!this.requireLogin()) return
    const item = this.data.item
    wx.showModal({
      title: '借用器材',
      editable: true,
      placeholderText: '请填写借用原因',
      content: `借用「${item.name}」，请填写借用原因：`,
      success: (res) => {
        if (!res.confirm) return
        const reason = (res.content || '').trim()
        if (!reason) {
          wx.showToast({ title: '请填写借用原因', icon: 'none' })
          return
        }
        this.doBorrow(reason)
      }
    })
  },

  async doBorrow(reason) {
    this.setData({ operating: true })
    try {
      const result = await this.callBorrow('borrow', { reason })
      if (result.code === 0) {
        wx.showToast({ title: '借用成功', icon: 'success' })
        this.loadDetail()
      } else {
        wx.showToast({ title: result.message || '借用失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '网络异常', icon: 'none' })
    } finally {
      this.setData({ operating: false })
    }
  },

  onReturn() {
    if (!this.requireLogin()) return
    const item = this.data.item
    wx.showModal({
      title: '归还器材',
      content: `归还「${item.name}」前需要拍摄一张照片作为归还凭证，确定继续吗？`,
      success: (res) => {
        if (!res.confirm) return
        this.chooseReturnImage()
      }
    })
  },

  chooseReturnImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const tempPath = res.tempFilePaths[0]
        this.uploadAndReturn(tempPath)
      },
      fail: () => {
        wx.showToast({ title: '未选择照片，已取消归还', icon: 'none' })
      }
    })
  },

  uploadAndReturn(tempPath) {
    wx.showLoading({ title: '上传中...' })
    const ext = tempPath.split('.').pop() || 'jpg'
    wx.cloud.uploadFile({
      cloudPath: `return/${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`,
      filePath: tempPath,
      success: (uploadRes) => {
        wx.hideLoading()
        this.doReturn(uploadRes.fileID)
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '上传失败', icon: 'none' })
      }
    })
  },

  async doReturn(returnImageFileID) {
    this.setData({ operating: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'borrow',
        data: { action: 'return', id: this.data.id, returnImageFileID }
      })
      const result = res.result || {}
      if (result.code === 0) {
        wx.showToast({ title: '归还成功', icon: 'success' })
        this.loadDetail()
      } else {
        wx.showToast({ title: result.message || '归还失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '网络异常', icon: 'none' })
    } finally {
      this.setData({ operating: false })
    }
  },

  callBorrow(action, extra = {}) {
    return wx.cloud.callFunction({
      name: 'borrow',
      data: { action, id: this.data.id, ...extra }
    }).then(res => res.result || {})
  }
})
