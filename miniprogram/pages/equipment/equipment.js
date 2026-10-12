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

  async onBorrow() {
    const item = this.data.item
    wx.showModal({
      title: '借用器材',
      content: `确定要借用「${item.name}」吗？借用后将记录你的姓名。`,
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ operating: true })
        try {
          const result = await this.callBorrow('borrow')
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
      }
    })
  },

  async onReturn() {
    const item = this.data.item
    wx.showModal({
      title: '归还器材',
      content: `确定归还「${item.name}」吗？`,
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ operating: true })
        try {
          const result = await this.callBorrow('return')
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
      }
    })
  },

  callBorrow(action) {
    return wx.cloud.callFunction({
      name: 'borrow',
      data: { action, id: this.data.id }
    }).then(res => res.result || {})
  }
})
