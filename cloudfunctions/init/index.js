const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const collections = ['users', 'equipment', 'borrow_records']
  const results = []

  for (const name of collections) {
    try {
      await db.createCollection(name)
      results.push({ name, status: 'created' })
    } catch (e) {
      results.push({ name, status: 'exists_or_failed', msg: e.message })
    }
  }

  return { code: 0, results }
}
