// 通用工具函数

// 器材分类
const CATEGORIES = ['机身', '镜头', '内存卡', '电池', '闪光灯', '读卡器']

// 调用云函数封装
function callCloud(name, data = {}) {
  return wx.cloud.callFunction({ name, data })
}

// 格式化时间
function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  const pad = n => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

module.exports = {
  CATEGORIES,
  callCloud,
  formatTime
}
