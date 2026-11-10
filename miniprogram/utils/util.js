// 通用工具函数

// 部门及各部门器材分类
const DEPARTMENTS = [
  { name: '记者团', categories: ['机身', '镜头', '内存卡', '电池', '闪光灯', '读卡器'] },
  { name: '电视台', categories: ['机身', '镜头', '稳定器', '内存卡', '灯具', '电池', '图传', '无人机', '麦克风', '脚架', '读卡器', '硬盘', '其他'] }
]

// 获取某部门的分类列表
function getCategories(department) {
  const d = DEPARTMENTS.find(x => x.name === department)
  return d ? d.categories : DEPARTMENTS[0].categories
}

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
  DEPARTMENTS,
  getCategories,
  callCloud,
  formatTime
}
