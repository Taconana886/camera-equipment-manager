const app = getApp()
const { CATEGORIES } = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    isAdmin: false,
    tab: 'all', // all / available / borrowed
    categories: CATEGORIES,
    selectedCategory: '全部',
    list: [],
    filteredList: [],
    loading: true,
    total: 0,
    availableCount: 0,
    borrowedCount: 0,
    showProfile: false,
    profileName: '',
    profileAvatarFileID: '',
    savingProfile: false
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo.openid) {
      app.globalData.userInfo = userInfo
      app.globalData.openid = userInfo.openid
      this.setData({
        userInfo,
        isAdmin: userInfo.isAdmin === true
      })
      this.refreshUserInfo()
    } else {
      this.setData({ userInfo: null, isAdmin: false })
    }
    this.loadList()
  },

  // 每次进入首页时从云端刷新最新身份（管理员权限变更后立即生效）
  async refreshUserInfo() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login', data: { action: 'login' } })
      const result = res.result || {}
      if (result.code === 0 && result.isNew) {
        // 用户已被管理员移除，清除本地登录状态
        wx.removeStorageSync('userInfo')
        app.globalData.userInfo = null
        app.globalData.openid = ''
        this.setData({ userInfo: null, isAdmin: false })
        return
      }
      if (result.code === 0 && result.userInfo) {
        const data = {
          openid: result.userInfo._openid,
          _id: result.userInfo._id,
          name: result.userInfo.name,
          avatarFileID: result.userInfo.avatarFileID || '',
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

  switchCategory(e) {
    const selectedCategory = e.currentTarget.dataset.category
    this.setData({ selectedCategory })
    this.applyFilter()
  },

  applyFilter() {
    const { tab, list, selectedCategory } = this.data
    let filteredList = list
    if (tab === 'available') filteredList = filteredList.filter(i => i.status === 'available')
    if (tab === 'borrowed') filteredList = filteredList.filter(i => i.status === 'borrowed')
    if (selectedCategory !== '全部') {
      filteredList = filteredList.filter(i => (i.category || '机身') === selectedCategory)
    }
    this.setData({ filteredList })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/equipment/equipment?id=' + id })
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },

  goRecords() {
    wx.navigateTo({ url: '/pages/records/records' })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  openProfile() {
    const userInfo = this.data.userInfo || {}
    this.setData({
      showProfile: true,
      profileName: userInfo.name || '',
      profileAvatarFileID: userInfo.avatarFileID || ''
    })
  },

  closeProfile() {
    this.setData({ showProfile: false })
  },

  noop() {},

  onProfileNameInput(e) {
    this.setData({ profileName: e.detail.value })
  },

  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFilePaths[0]
        wx.showLoading({ title: '上传中...' })
        const ext = tempPath.split('.').pop() || 'jpg'
        wx.cloud.uploadFile({
          cloudPath: `avatars/${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`,
          filePath: tempPath,
          success: (uploadRes) => {
            this.setData({ profileAvatarFileID: uploadRes.fileID })
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

  async saveProfile() {
    const name = this.data.profileName.trim()
    if (!name) {
      wx.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }

    this.setData({ savingProfile: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: {
          action: 'updateProfile',
          name,
          avatarFileID: this.data.profileAvatarFileID
        }
      })
      const result = res.result || {}
      if (result.code === 0 && result.userInfo) {
        const data = {
          openid: result.userInfo._openid,
          _id: result.userInfo._id,
          name: result.userInfo.name,
          avatarFileID: result.userInfo.avatarFileID || '',
          isAdmin: result.userInfo.isAdmin === true
        }
        wx.setStorageSync('userInfo', data)
        app.globalData.userInfo = data
        this.setData({ userInfo: data, isAdmin: data.isAdmin, showProfile: false })
        wx.showToast({ title: '保存成功', icon: 'success' })
      } else {
        wx.showToast({ title: result.message || '保存失败', icon: 'none' })
      }
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '网络异常', icon: 'none' })
    } finally {
      this.setData({ savingProfile: false })
    }
  },

  onPullDownRefresh() {
    this.loadList().then(() => wx.stopPullDownRefresh())
  }
})
