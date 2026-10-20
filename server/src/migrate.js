import mongoose from 'mongoose'

const sanitize = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 24)

// One-time upgrades for databases created by earlier versions. Safe to re-run.
// Runs before indexes are built, so it must only use the raw collection API.
export async function migrate() {
  const users = mongoose.connection.collection('users')

  // v1 accounts signed in with an email (unique index "email_1"). Accounts are
  // now identified by username, so that index would reject new users.
  try {
    await users.dropIndex('email_1')
  } catch (err) {
    const missing = err.codeName === 'IndexNotFound' || err.codeName === 'NamespaceNotFound'
    if (!missing) throw err
  }

  // Give every legacy account a username: the part of the email before "@".
  const legacy = await users.find({ username: { $exists: false } }).toArray()
  for (const user of legacy) {
    const base = sanitize((user.email ?? '').split('@')[0]).padEnd(3, '0') || 'user'
    let username = base
    for (let n = 2; await users.findOne({ username }, { projection: { _id: 1 } }); n++) {
      username = `${base}${n}`
    }
    await users.updateOne({ _id: user._id }, { $set: { username }, $unset: { email: '' } })
    console.log(`[migrate] user ${user._id} now signs in as "${username}"`)
  }
}
