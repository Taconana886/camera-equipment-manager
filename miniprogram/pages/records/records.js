const app = getApp()
const { formatTime } = require('../../utils/util')

Page({
  data: {
    recordList: [],
    loading: true,
    isAdmin: false
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.openid) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    this.setData({ isAdmin: userInfo.isAdmin === true })
    this.loadRecords()
  },

  async loadRecords() {
    this.setData({ loading: true })
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

  previewImage(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.previewImage({ urls: [url] })
  },

  onPullDownRefresh() {
    this.loadRecords().then(() => wx.stopPullDownRefresh())
  }
})
