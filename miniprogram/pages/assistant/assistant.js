const STORAGE_KEY = 'aiChatMessages'

const QUICK_QUESTIONS = [
  '现在有哪些镜头可以借？',
  '帮我推荐一套拍晚会的机身+镜头组合',
  '怎么借用和归还器材？',
  '闪光灯现在谁借走了？'
]

Page({
  data: {
    messages: [],
    inputValue: '',
    sending: false,
    showQuick: true,
    scrollToId: '',
    quickQuestions: QUICK_QUESTIONS
  },

  onLoad() {
    const saved = wx.getStorageSync(STORAGE_KEY)
    if (Array.isArray(saved) && saved.length > 0) {
      this.setData({ messages: saved, showQuick: false })
      this.scrollToBottom()
    }
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  tapQuick(e) {
    const q = e.currentTarget.dataset.q
    this.setData({ inputValue: q })
    this.send()
  },

  scrollToBottom() {
    this.setData({ scrollToId: 'msg-bottom' })
  },

  async send() {
    const question = this.data.inputValue.trim()
    if (!question || this.data.sending) return

    const messages = this.data.messages.concat([{ role: 'user', content: question }])
    this.setData({
      messages,
      inputValue: '',
      sending: true,
      showQuick: false,
      scrollToId: 'msg-bottom'
    })

    const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await wx.cloud.callFunction({
        name: 'ai',
        data: { action: 'chat', question, history }
      })
      const result = res.result || {}
      if (result.code !== 0 || !result.reply) {
        this.appendAi(result.message || 'AI 暂时没有回答，请稍后再试')
        return
      }
      this.typewriter(result.reply)
    } catch (e) {
      console.error('AI 调用失败', e)
      this.appendAi('网络异常，请稍后再试')
    }
  },

  // 逐字显示 AI 回复
  typewriter(fullText) {
    const baseLen = this.data.messages.length
    const aiMsg = { role: 'ai', content: '' }
    this.setData({
      messages: this.data.messages.concat([aiMsg]),
      sending: false
    })

    let i = 0
    const timer = setInterval(() => {
      i += 2
      const part = fullText.slice(0, i)
      const key = `messages[${baseLen}].content`
      this.setData({ [key]: part })
      this.scrollToBottom()
      if (i >= fullText.length) {
        clearInterval(timer)
        this.saveMessages()
      }
    }, 30)
  },

  appendAi(text) {
    this.setData({
      messages: this.data.messages.concat([{ role: 'ai', content: text }]),
      sending: false
    })
    this.saveMessages()
    this.scrollToBottom()
  },

  saveMessages() {
    const list = this.data.messages.slice(-20)
    wx.setStorageSync(STORAGE_KEY, list)
  },

  onUnload() {
    this.saveMessages()
  }
})
