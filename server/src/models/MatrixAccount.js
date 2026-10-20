import mongoose from 'mongoose'

// A user's Matrix login. Bridges (WhatsApp, Instagram, Discord, ...) live on the
// homeserver; Bird reads and writes through this one account.
const matrixAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    homeserver: { type: String, required: true }, // e.g. https://matrix.example.com
    mxid: { type: String, required: true }, // e.g. @ada:example.com
    deviceId: String,
    accessTokenEnc: { type: String, required: true }, // encrypted, never sent to the client
    since: String, // next_batch of the last applied /sync
    status: { type: String, enum: ['syncing', 'error'], default: 'syncing' },
    lastError: String,
    lastSyncAt: Date,
  },
  { timestamps: true },
)

export const MatrixAccount = mongoose.model('MatrixAccount', matrixAccountSchema)

export const serializeMatrixAccount = (a) =>
  a && {
    homeserver: a.homeserver,
    mxid: a.mxid,
    status: a.status,
    lastError: a.lastError,
    lastSyncAt: a.lastSyncAt,
  }
