const cloud = require('wx-server-sdk')
const https = require('https')
const config = require('./config')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const equipmentCol = db.collection('equipment')

const SYSTEM_PROMPT = `你是「记者团器材管理」小程序的 AI 智能助手，名字叫「幸运团长」。你服务于记者团和电视台两个部门的成员，帮助他们查询、借用摄影器材。

你的能力：
1. 器材查询：根据实时器材台账回答"有什么""在不在""谁借走了"等问题
2. 器材推荐：根据拍摄场景（晚会、运动会、采访、外拍、夜景等）推荐合适的机身/镜头/配件组合
3. 流程答疑：解答借用、归还、权限等使用问题

器材借用规则（回答流程问题时参考）：
- 借用：进入小程序首页，点开器材详情，点「借用」并填写借用原因
- 归还：借用人本人或管理员可归还，归还时需拍一张照片作为归还凭证
- 登录：借用和归还需要登录（微信登录并填写姓名），浏览器材不需要登录
- 管理员：可添加/编辑/删除器材，可查看全部借用记录

回答规则：
1. 关于器材的"有没有、能不能借、谁借了"等问题，必须严格依据下面「器材实时台账」回答，台账里没有的器材要如实说明"当前台账中没有"
2. 不得编造器材名称、编号或库存
3. 回答简洁，多用短列表，不要长篇大论
4. 语气友好、活泼，可用少量 emoji
5. 若用户问与器材管理无关的问题，礼貌说明你只负责器材相关咨询`

function buildEquipmentTable(list) {
  return list.map(i => ({
    部门: i.department || '记者团',
    分类: i.category || '',
    名称: i.name || '',
    品牌型号: i.brand || '',
    编号: i.code || '',
    状态: i.status === 'available' ? '在器材室' : '已借出',
    借用人: i.currentBorrower || '',
    借用原因: i.currentReason || '',
    备注: i.remark || ''
  }))
}

function callDeepSeek(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: config.MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1200,
      stream: false
    })

    const req = https.request(config.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.API_KEY
      },
      timeout: 50000
    }, (res) => {
      let raw = ''
      res.on('data', chunk => { raw += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(raw)
          if (json.error) {
            reject(new Error(json.error.message || 'API 错误'))
            return
          }
          const reply = json.choices && json.choices[0] && json.choices[0].message
            ? json.choices[0].message.content.trim()
            : ''
          resolve(reply)
        } catch (e) {
          reject(new Error('响应解析失败'))
        }
      })
    })

    req.on('error', e => reject(e))
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('请求超时'))
    })
    req.write(body)
    req.end()
  })
}

exports.main = async (event, context) => {
  const action = event.action || 'chat'

  try {
    switch (action) {
      case 'chat': {
        const question = (event.question || '').trim()
        if (!question) return { code: 1, message: '请输入问题' }
        if (question.length > 500) return { code: 1, message: '问题太长了' }

        if (!config.API_KEY || config.API_KEY.indexOf('请替换') >= 0) {
          return { code: 1, message: 'AI 助手未配置 API Key，请管理员在云函数 config.js 中填写' }
        }

        // 拉取实时器材台账
        const res = await equipmentCol.orderBy('createTime', 'desc').limit(1000).get()
        const table = buildEquipmentTable(res.data || [])
        const dataBlock = JSON.stringify(table, null, 1)

        // 组装消息（历史最多保留 6 轮，控制 token）
        const history = Array.isArray(event.history) ? event.history.slice(-6) : []
        const messages = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'),
          {
            role: 'user',
            content: `【器材实时台账】\n${dataBlock}\n\n【用户问题】\n${question}`
          }
        ]

        const reply = await callDeepSeek(messages)
        if (!reply) return { code: 1, message: 'AI 暂时没有回答，请稍后再试' }

        return { code: 0, reply }
      }

      default:
        return { code: 1, message: '未知操作' }
    }
  } catch (err) {
    console.error('ai 云函数异常', err)
    return { code: 1, message: 'AI 助手服务异常，请稍后再试', error: err.message }
  }
}
