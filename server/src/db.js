import mongoose from 'mongoose'

export async function connectDb(uri) {
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  // Make sure unique indexes (email, per-user chat ids, ...) exist before serving.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()))
  return mongoose.connection
}

export async function disconnectDb() {
  await mongoose.disconnect()
}
