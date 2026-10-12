const app = getApp()

Page({
  data: {
    userInfo: null,
    isAdmin: false,
    tab: 'all', // all / available / borrowed
    list: [],
    filteredList: [],
    loading: true,
    total: 0,
    availableCount: 0,
    borrowedCount: 0
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.openid) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    app.globalData.userInfo = userInfo
    app.globalData.openid = userInfo.openid
    this.setData({
      userInfo,
      isAdmin: userInfo.isAdmin === true
    })
    this.loadList()
    this.refreshUserInfo()
  },

  // 每次进入首页时从云端刷新最新身份（管理员权限变更后立即生效）
  async refreshUserInfo() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login', data: { action: 'login' } })
      const result = res.result || {}
      if (result.code === 0 && result.userInfo) {
        const data = {
          openid: result.userInfo._openid,
          _id: result.userInfo._id,
          name: result.userInfo.name,
          isAdmin: result.userInfo.isAdmin === true
        }
        wx.setStorageSync('userInfo', data)
        app.globalData.userInfo = data
        this.setData({ userInfo: data, isAdmin: data.isAdmin })
      }
    } catch (e) {
      console.error('刷新用户信息失败', e)
    }
  },

  async loadList() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: { action: 'list' }
      })
      const result = res.result || {}
      if (result.code === 0) {
        const list = result.list || []
        const availableCount = list.filter(i => i.status === 'available').length
        const borrowedCount = list.filter(i => i.status === 'borrowed').length
        this.setData({ list, total: list.length, availableCount, borrowedCount })
        this.applyFilter()
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

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab })
    this.applyFilter()
  },

  applyFilter() {
    const { tab, list } = this.data
    let filteredList = list
    if (tab === 'available') filteredList = list.filter(i => i.status === 'available')
    if (tab === 'borrowed') filteredList = list.filter(i => i.status === 'borrowed')
    this.setData({ filteredList })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/equipment/equipment?id=' + id })
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },

  onPullDownRefresh() {
    this.loadList().then(() => wx.stopPullDownRefresh())
  }
})
