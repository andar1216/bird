import mongoose from 'mongoose'
import { NETWORKS } from '../networks.js'

// One row per (user, network): which adapter feeds that user's chats.
const connectionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    network: { type: String, enum: NETWORKS, required: true },
    provider: { type: String, required: true }, // adapter id, e.g. "demo"
    status: {
      type: String,
      enum: ['connecting', 'connected', 'error'],
      default: 'connecting',
    },
    label: { type: String, maxlength: 120 }, // e.g. account name shown in the UI
    lastSyncAt: Date,
  },
  { timestamps: true },
)
connectionSchema.index({ userId: 1, network: 1 }, { unique: true })

export const Connection = mongoose.model('Connection', connectionSchema)
