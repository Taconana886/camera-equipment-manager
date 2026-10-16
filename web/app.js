// 记者团器材管理 - 网页版
const ENV = 'cloud1-d5gjwi2eze187d7e6'
const CATEGORIES = ['机身', '镜头', '内存卡', '电池', '闪光灯', '读卡器']

let app = null
let auth = null
let token = localStorage.getItem('token') || ''
let currentUser = null
let equipmentList = []
let currentEquipment = null
let statusFilter = 'all'
let categoryFilter = '全部'
let isRegisterMode = false

// ---------- 初始化 ----------
async function init() {
  app = cloudbase.init({ env: ENV })
  auth = app.auth({ persistence: 'local' })
  try {
    await auth.signInAnonymously()
  } catch (e) {
    console.error('匿名登录失败', e)
  }

  bindEvents()

  if (token) {
    const r = await call('login', { action: 'getByToken' })
    if (r.code === 0) {
      currentUser = r.userInfo
      showMain()
      return
    }
  }
  token = ''
  localStorage.removeItem('token')
  showLogin()
}

// ---------- 云函数调用 ----------
async function call(name, data = {}) {
  if (token) data.token = token
  try {
    const res = await app.callFunction({ name, data })
    return res.result || {}
  } catch (e) {
    console.error('云函数调用失败', name, e)
    return { code: 1, message: '网络异常' }
  }
}

// ---------- 图片转换 ----------
async function batchToUrl(list, field) {
  const ids = list.map(i => i[field]).filter(id => id && !id.startsWith('http'))
  const unique = [...new Set(ids)]
  if (unique.length === 0) return {}
  try {
    const res = await app.getTempFileURL({ fileList: unique })
    const map = {}
    ;(res.fileList || []).forEach(f => {
      if (f.tempFileURL) map[f.fileID] = f.tempFileURL
    })
    return map
  } catch (e) {
    return {}
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function fmtTime(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  const p = n => (n < 10 ? '0' + n : '' + n)
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`
}

// ---------- 视图切换 ----------
function show(viewId) {
  document.querySelectorAll('.view').forEach(v => (v.style.display = 'none'))
  document.getElementById(viewId).style.display = 'block'
}

function showLogin() {
  isRegisterMode = false
  document.getElementById('btn-login').textContent = '登 录'
  document.getElementById('link-register').textContent = '立即注册'
  document.getElementById('login-name').value = ''
  document.getElementById('login-password').value = ''
  show('view-login')
}

function showMain() {
  renderUser()
  show('view-main')
  loadEquipment()
}

function showDetail() {
  show('view-detail')
}

function showAdmin() {
  show('view-admin')
  loadAdmin()
}

function renderUser() {
  if (!currentUser) return
  document.getElementById('main-name').textContent = currentUser.name
  document.getElementById('main-role').textContent =
    (currentUser.isAdmin ? '管理员' : '普通成员') + ' · 点击编辑资料'
  document.getElementById('btn-admin').style.display = currentUser.isAdmin ? 'inline-block' : 'none'

  const avatar = document.getElementById('main-avatar')
  if (currentUser.avatarFileID) {
    batchToUrl([{ avatarFileID: currentUser.avatarFileID }], 'avatarFileID').then(map => {
      avatar.src = map[currentUser.avatarFileID] || ''
    })
  } else {
    avatar.src = ''
  }
}

// ---------- 登录/注册 ----------
async function doLogin() {
  const name = document.getElementById('login-name').value.trim()
  const password = document.getElementById('login-password').value
  if (!name || !password) return toast('请填写姓名和密码')

  const action = isRegisterMode ? 'register' : 'login'
  const r = await call('login', { action, name, password })
  if (r.code === 0 && r.token) {
    token = r.token
    localStorage.setItem('token', token)
    currentUser = r.userInfo
    showMain()
  } else {
    toast(r.message || '操作失败')
  }
}

// ---------- 器材列表 ----------
async function loadEquipment() {
  const r = await call('equipment', { action: 'list' })
  if (r.code === 0) {
    equipmentList = r.list || []
    renderCategories()
    renderEquipment()
  }
}

function renderCategories() {
  const bar = document.getElementById('cat-bar')
  const cats = ['全部', ...CATEGORIES]
  bar.innerHTML = cats
    .map(c => `<div class="cat-item ${categoryFilter === c ? 'active' : ''}" data-cat="${c}">${c}</div>`)
    .join('')
  bar.querySelectorAll('.cat-item').forEach(el => {
    el.addEventListener('click', () => {
      categoryFilter = el.dataset.cat
      renderCategories()
      renderEquipment()
    })
  })
}

async function renderEquipment() {
  const listEl = document.getElementById('equip-list')
  let list = equipmentList
  if (statusFilter !== 'all') list = list.filter(i => i.status === statusFilter)
  if (categoryFilter !== '全部') list = list.filter(i => (i.category || '机身') === categoryFilter)

  if (list.length === 0) {
    listEl.innerHTML = '<div class="empty">暂无器材</div>'
    return
  }

  const urlMap = await batchToUrl(list, 'imageFileID')
  listEl.innerHTML = list
    .map(item => {
      const img = item.imageFileID
        ? `<img class="equip-img" src="${urlMap[item.imageFileID] || ''}" />`
        : `<div class="equip-img equip-img-empty">📷</div>`
      const status = item.status === 'available' ? '在器材室' : '已借出'
      const cls = item.status === 'available' ? 'available' : 'borrowed'
      const borrower = item.status === 'borrowed'
        ? `<span class="borrower">借用人：${escapeHtml(item.currentBorrower)}</span>` : ''
      return `<div class="card equip-card" data-id="${item._id}">
        ${img}
        <div class="equip-body">
          <div class="equip-name-row">
            <div class="equip-name">${escapeHtml(item.name)}</div>
            <div class="cat-tag">${escapeHtml(item.category || '机身')}</div>
          </div>
          <div class="equip-meta">${escapeHtml(item.brand || '')}${item.brand && item.code ? ' · ' : ''}${escapeHtml(item.code || '')}</div>
          <div><span class="status-tag ${cls}">${status}</span>${borrower}</div>
        </div>
      </div>`
    })
    .join('')

  listEl.querySelectorAll('.equip-card').forEach(el => {
    el.addEventListener('click', () => openDetail(el.dataset.id))
  })
}

// ---------- 详情 ----------
async function openDetail(id) {
  const r = await call('equipment', { action: 'detail', id })
  if (r.code === 0 && r.item) {
    currentEquipment = r.item
    renderDetail()
    showDetail()
  }
}

async function renderDetail() {
  const item = currentEquipment
  document.getElementById('detail-name').textContent = item.name

  const statusEl = document.getElementById('detail-status')
  statusEl.textContent = item.status === 'available' ? '在器材室' : '已借出'
  statusEl.className = 'status-tag ' + (item.status === 'available' ? 'available' : 'borrowed')

  // 图片
  const imgEl = document.getElementById('detail-img')
  if (item.imageFileID) {
    const map = await batchToUrl([item], 'imageFileID')
    imgEl.src = map[item.imageFileID] || ''
    imgEl.style.display = 'block'
  } else {
    imgEl.style.display = 'none'
  }

  // 信息
  let info = ''
  if (item.category) info += infoRow('分类', item.category)
  if (item.code) info += infoRow('编号', item.code)
  if (item.brand) info += infoRow('品牌型号', item.brand)
  if (item.remark) info += infoRow('备注', item.remark)
  document.getElementById('detail-info').innerHTML = info

  // 借用信息
  const borrowEl = document.getElementById('detail-borrow-info')
  if (item.status === 'borrowed') {
    let b = `<div class="borrow-title">当前借用信息</div>
      <div class="borrow-line">借用人：${escapeHtml(item.currentBorrower)}</div>`
    if (item.currentReason) b += `<div class="borrow-line">申请原因：${escapeHtml(item.currentReason)}</div>`
    if (item.borrowTime) b += `<div class="borrow-line">借用时间：${fmtTime(item.borrowTime)}</div>`
    borrowEl.innerHTML = b
    borrowEl.style.display = 'block'
  } else {
    borrowEl.style.display = 'none'
  }

  // 按钮
  document.getElementById('btn-borrow').style.display = item.status === 'available' ? 'block' : 'none'
  const canReturn = item.status === 'borrowed' &&
    (currentUser && (currentUser.isAdmin || item.currentBorrowerToken === token))
  document.getElementById('btn-return').style.display = canReturn ? 'block' : 'none'
}

function infoRow(label, value) {
  return `<div class="info-row"><div class="info-label">${label}</div><div class="info-value">${escapeHtml(value)}</div></div>`
}

// ---------- 借用 ----------
function doBorrow() {
  if (!currentUser) return toast('请先登录')
  const item = currentEquipment
  showModal('借用器材', `
    <div class="form-field">
      <div class="form-label">借用「${escapeHtml(item.name)}」，请填写借用原因：</div>
      <textarea id="input-reason" class="input" placeholder="借用原因（必填）"></textarea>
    </div>`, [
    { text: '取消', cls: 'btn-cancel', onClick: closeModal },
    { text: '确认借用', cls: 'btn-primary', onClick: async () => {
      const reason = document.getElementById('input-reason').value.trim()
      if (!reason) return toast('请填写借用原因')
      closeModal()
      const r = await call('borrow', { action: 'borrow', id: item._id, reason })
      if (r.code === 0) {
        toast('借用成功')
        openDetail(item._id)
      } else {
        toast(r.message || '借用失败')
      }
    } }
  ])
}

// ---------- 归还 ----------
function doReturn() {
  const item = currentEquipment
  if (!confirm(`归还「${item.name}」前需要拍摄一张照片作为归还凭证，确定继续吗？`)) return

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.capture = 'environment'
  input.onchange = async () => {
    const file = input.files[0]
    if (!file) return
    try {
      const fileID = await uploadFile(file, 'return')
      const r = await call('borrow', { action: 'return', id: item._id, returnImageFileID: fileID })
      if (r.code === 0) {
        toast('归还成功')
        openDetail(item._id)
      } else {
        toast(r.message || '归还失败')
      }
    } catch (e) {
      toast('上传失败')
    }
  }
  input.click()
}

// ---------- 文件上传 ----------
function uploadFile(file, folder) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const cloudPath = `${folder}/${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`
  return app.uploadFile({ cloudPath, filePath: file }).then(res => res.fileID)
}

// ---------- 管理后台 ----------
let adminTab = 'equipment'

async function loadAdmin() {
  await renderAdminTab()
}

async function renderAdminTab() {
  const el = document.getElementById('admin-content')
  if (adminTab === 'equipment') {
    const r = await call('equipment', { action: 'list' })
    const list = r.code === 0 ? (r.list || []) : []
    let html = `<div class="list-head"><span>共 ${list.length} 件器材</span><span class="add-btn" id="btn-add-equip">＋ 添加器材</span></div>`
    html += list.map(item => `
      <div class="card admin-card">
        <div class="admin-card-main">
          <div class="admin-card-name">${escapeHtml(item.name)} <span class="status-tag ${item.status === 'available' ? 'available' : 'borrowed'}">${item.status === 'available' ? '在器材室' : '已借出'}</span></div>
          <div class="admin-card-meta">${escapeHtml(item.category || '')} ${escapeHtml(item.brand || '')} ${escapeHtml(item.code || '')}</div>
        </div>
        <div>
          <div class="op" data-edit="${item._id}">编辑</div>
          <div class="op op-delete" data-del="${item._id}">删除</div>
        </div>
      </div>`).join('') || '<div class="empty">暂无器材</div>'
    el.innerHTML = html
    el.querySelector('#btn-add-equip')?.addEventListener('click', () => openEquipForm(null))
    el.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEquipForm(b.dataset.edit)))
    el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteEquip(b.dataset.del)))
  } else if (adminTab === 'users') {
    const r = await call('admin', { action: 'listUsers' })
    if (r.code !== 0) {
      el.innerHTML = `<div class="empty">${r.message || '加载失败'}</div>`
      return
    }
    const list = r.list || []
    const urlMap = await batchToUrl(list, 'avatarFileID')
    let html = `<div class="list-head"><span>共 ${list.length} 位用户</span></div>`
    html += list.map(u => `
      <div class="card user-card">
        <div style="display:flex;align-items:center;flex:1;min-width:0">
          ${u.avatarFileID ? `<img class="user-avatar" src="${urlMap[u.avatarFileID] || ''}" />` : `<div class="user-avatar user-avatar-text">${escapeHtml((u.name || '?')[0])}</div>`}
          <div>
            <div class="admin-card-name">${escapeHtml(u.name)}</div>
            <div class="admin-card-meta">${u.isAdmin ? '管理员' : '普通成员'}</div>
          </div>
        </div>
        <div>
          <div class="op" data-admin="${u._id}" data-target="${u.isAdmin ? 0 : 1}">${u.isAdmin ? '取消管理员' : '设为管理员'}</div>
          <div class="op op-delete" data-remove="${u._id}">移除</div>
        </div>
      </div>`).join('') || '<div class="empty">暂无用户</div>'
    el.innerHTML = html
    el.querySelectorAll('[data-admin]').forEach(b => b.addEventListener('click', () => {
      setAdmin(b.dataset.admin, b.dataset.target === '1')
    }))
    el.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => removeUser(b.dataset.remove)))
  } else if (adminTab === 'records') {
    const r = await call('borrow', { action: 'records' })
    const list = r.code === 0 ? (r.list || []) : []
    const urlMap = await batchToUrl(list, 'returnImageFileID')
    let html = `<div class="list-head"><span>共 ${list.length} 条记录</span></div>`
    html += list.map(rec => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div class="admin-card-name">${escapeHtml(rec.equipmentName)}</div>
          <span class="status-tag ${rec.status === 'borrowed' ? 'borrowed' : 'available'}">${rec.status === 'borrowed' ? '借出中' : '已归还'}</span>
        </div>
        <div class="borrow-line">借用人：${escapeHtml(rec.borrowerName)}</div>
        ${rec.reason ? `<div class="borrow-line">申请原因：${escapeHtml(rec.reason)}</div>` : ''}
        <div class="borrow-line">借用时间：${fmtTime(rec.borrowTime)}</div>
        ${rec.status === 'returned' ? `<div class="borrow-line">归还时间：${fmtTime(rec.returnTime)}</div>` : ''}
        ${rec.status === 'returned' && rec.returnImageFileID ? `<img class="record-img" src="${urlMap[rec.returnImageFileID] || ''}" />` : ''}
      </div>`).join('') || '<div class="empty">暂无记录</div>'
    el.innerHTML = html
  }
}

async function openEquipForm(id) {
  const item = id ? (await call('equipment', { action: 'detail', id })).item : null
  const cats = CATEGORIES.map((c, i) => `<option value="${c}" ${item && item.category === c ? 'selected' : ''}>${c}</option>`).join('')
  showModal(id ? '编辑器材' : '添加器材', `
    <div class="form-field"><div class="form-label">名称 *</div><input id="f-name" class="input" value="${escapeHtml(item?.name || '')}" placeholder="器材名称" /></div>
    <div class="form-field"><div class="form-label">分类</div><select id="f-category" class="input">${cats}</select></div>
    <div class="form-field"><div class="form-label">编号</div><input id="f-code" class="input" value="${escapeHtml(item?.code || '')}" placeholder="如 CAM-001" /></div>
    <div class="form-field"><div class="form-label">品牌型号</div><input id="f-brand" class="input" value="${escapeHtml(item?.brand || '')}" placeholder="品牌 / 型号" /></div>
    <div class="form-field"><div class="form-label">备注</div><input id="f-remark" class="input" value="${escapeHtml(item?.remark || '')}" placeholder="备注（可选）" /></div>
    <div class="form-field"><div class="form-label">图片</div><input id="f-image" type="file" accept="image/*" /></div>
  `, [
    { text: '取消', cls: 'btn-cancel', onClick: closeModal },
    { text: '保存', cls: 'btn-primary', onClick: async () => {
      const name = document.getElementById('f-name').value.trim()
      if (!name) return toast('请填写名称')
      const data = {
        action: id ? 'update' : 'add',
        name,
        category: document.getElementById('f-category').value,
        code: document.getElementById('f-code').value.trim(),
        brand: document.getElementById('f-brand').value.trim(),
        remark: document.getElementById('f-remark').value.trim()
      }
      if (id) data.id = id
      const imgInput = document.getElementById('f-image')
      if (imgInput.files && imgInput.files[0]) {
        try { data.imageFileID = await uploadFile(imgInput.files[0], 'equipment') }
        catch (e) { return toast('图片上传失败') }
      }
      const r = await call('equipment', data)
      if (r.code === 0) {
        closeModal()
        toast(id ? '修改成功' : '添加成功')
        renderAdminTab()
        if (!id) loadEquipment()
      } else {
        toast(r.message || '操作失败')
      }
    } }
  ])
}

function deleteEquip(id) {
  const item = equipmentList.find(i => i._id === id)
  if (!confirm(`确定删除「${item?.name || ''}」吗？`)) return
  call('equipment', { action: 'delete', id }).then(r => {
    toast(r.code === 0 ? '删除成功' : (r.message || '删除失败'))
    renderAdminTab()
    loadEquipment()
  })
}

function setAdmin(userId, target) {
  call('admin', { action: 'setAdmin', userId, isAdmin: target }).then(r => {
    toast(r.message || '操作失败')
    renderAdminTab()
  })
}

function removeUser(userId) {
  if (!confirm('确定移除该用户吗？移除后该用户将无法再借用器材。')) return
  call('admin', { action: 'deleteUser', userId }).then(r => {
    toast(r.message || '移除失败')
    renderAdminTab()
  })
}

// ---------- 个人资料 ----------
function openProfile() {
  showModal('编辑资料', `
    <div class="form-field"><div class="form-label">姓名</div><input id="p-name" class="input" value="${escapeHtml(currentUser?.name || '')}" /></div>
    <div class="form-field"><div class="form-label">头像</div><input id="p-avatar" type="file" accept="image/*" /></div>
  `, [
    { text: '取消', cls: 'btn-cancel', onClick: closeModal },
    { text: '保存', cls: 'btn-primary', onClick: async () => {
      const name = document.getElementById('p-name').value.trim()
      if (!name) return toast('请填写姓名')
      const data = { action: 'updateProfile', name }
      const av = document.getElementById('p-avatar')
      if (av.files && av.files[0]) {
        try { data.avatarFileID = await uploadFile(av.files[0], 'avatars') }
        catch (e) { return toast('头像上传失败') }
      }
      const r = await call('login', data)
      if (r.code === 0) {
        currentUser = r.userInfo
        closeModal()
        toast('保存成功')
        renderUser()
      } else {
        toast(r.message || '保存失败')
      }
    } }
  ])
}

// ---------- 借用记录（成员视角）----------
function openRecords() {
  call('borrow', { action: 'records' }).then(async r => {
    const list = r.code === 0 ? (r.list || []) : []
    const urlMap = await batchToUrl(list, 'returnImageFileID')
    let html = `<div class="list-head"><span>共 ${list.length} 条记录</span></div>`
    html += list.map(rec => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div class="admin-card-name">${escapeHtml(rec.equipmentName)}</div>
          <span class="status-tag ${rec.status === 'borrowed' ? 'borrowed' : 'available'}">${rec.status === 'borrowed' ? '借出中' : '已归还'}</span>
        </div>
        ${rec.reason ? `<div class="borrow-line">申请原因：${escapeHtml(rec.reason)}</div>` : ''}
        <div class="borrow-line">借用时间：${fmtTime(rec.borrowTime)}</div>
        ${rec.status === 'returned' ? `<div class="borrow-line">归还时间：${fmtTime(rec.returnTime)}</div>` : ''}
      </div>`).join('') || '<div class="empty">暂无记录</div>'
    showModal('借用记录', html, [{ text: '关闭', cls: 'btn-primary', onClick: closeModal }])
  })
}

// ---------- Modal ----------
function showModal(title, bodyHTML, buttons) {
  document.getElementById('modal-title').textContent = title
  document.getElementById('modal-body').innerHTML = bodyHTML
  const btnsEl = document.getElementById('modal-btns')
  btnsEl.innerHTML = ''
  buttons.forEach(b => {
    const btn = document.createElement('button')
    btn.textContent = b.text
    btn.className = 'btn ' + (b.cls || '')
    btn.addEventListener('click', b.onClick)
    btnsEl.appendChild(btn)
  })
  document.getElementById('modal').style.display = 'flex'
}

function closeModal() {
  document.getElementById('modal').style.display = 'none'
}

function toast(msg) {
  let t = document.getElementById('toast')
  if (!t) {
    t = document.createElement('div')
    t.id = 'toast'
    t.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.75);color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:200;'
    document.body.appendChild(t)
  }
  t.textContent = msg
  t.style.display = 'block'
  clearTimeout(t._timer)
  t._timer = setTimeout(() => (t.style.display = 'none'), 1800)
}

// ---------- 事件绑定 ----------
function bindEvents() {
  document.getElementById('btn-login').addEventListener('click', doLogin)
  document.getElementById('link-register').addEventListener('click', () => {
    isRegisterMode = !isRegisterMode
    document.getElementById('btn-login').textContent = isRegisterMode ? '注 册' : '登 录'
    document.getElementById('link-register').textContent = isRegisterMode ? '已有账号？去登录' : '立即注册'
  })
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin()
  })

  document.querySelectorAll('#status-tabs .tab').forEach(t => {
    t.addEventListener('click', () => {
      statusFilter = t.dataset.status
      document.querySelectorAll('#status-tabs .tab').forEach(x => x.classList.remove('active'))
      t.classList.add('active')
      renderEquipment()
    })
  })

  document.querySelectorAll('#admin-tabs .tab').forEach(t => {
    t.addEventListener('click', () => {
      adminTab = t.dataset.atab
      document.querySelectorAll('#admin-tabs .tab').forEach(x => x.classList.remove('active'))
      t.classList.add('active')
      renderAdminTab()
    })
  })

  document.getElementById('btn-records').addEventListener('click', openRecords)
  document.getElementById('btn-admin').addEventListener('click', showAdmin)
  document.getElementById('btn-edit-profile').addEventListener('click', openProfile)
  document.getElementById('btn-back-list').addEventListener('click', showMain)
  document.getElementById('btn-back-main').addEventListener('click', showMain)
  document.getElementById('btn-borrow').addEventListener('click', doBorrow)
  document.getElementById('btn-return').addEventListener('click', doReturn)

  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal()
  })
}

init()
