App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-d5gjwi2eze187d7e6',
        traceUser: true
      })
    }

    // 启动时检查本地是否已登录过
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo.openid) {
      this.globalData.userInfo = userInfo
    }
  },

  globalData: {
    userInfo: null,
    openid: ''
  }
})
