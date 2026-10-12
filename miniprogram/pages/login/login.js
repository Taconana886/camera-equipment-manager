const app = getApp()

Page({
  data: {
    name: '',
    loading: false,
    isNew: true
  },

  onLoad() {
    // 已登录则直接进入首页
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo.openid) {
      app.globalData.userInfo = userInfo
      app.globalData.openid = userInfo.openid
      wx.reLaunch({ url: '/pages/index/index' })
      return
    }

    // 尝试静默登录，判断是否已注册
    this.checkLogin()
  },

  // 静默检查是否已注册
  async checkLogin() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: { action: 'login' }
      })
      const result = res.result || {}
      if (result.code === 0 && !result.isNew && result.userInfo) {
        this.saveAndGo(result.userInfo)
      } else {
        this.setData({ isNew: true })
      }
    } catch (e) {
      console.error('检查登录失败', e)
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  async submit() {
    const name = this.data.name.trim()
    if (!name) {
      wx.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: { action: 'register', name }
      })
      const result = res.result || {}
      if (result.code === 0 && result.userInfo) {
        this.saveAndGo(result.userInfo)
      } else {
        wx.showToast({ title: result.message || '登录失败', icon: 'none' })
      }
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '网络异常', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  saveAndGo(userInfo) {
    const data = {
      openid: userInfo._openid,
      _id: userInfo._id,
      name: userInfo.name,
      isAdmin: userInfo.isAdmin === true
    }
    wx.setStorageSync('userInfo', data)
    app.globalData.userInfo = data
    app.globalData.openid = data.openid
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
