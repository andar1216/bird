import mongoose from 'mongoose'

// Opaque bearer sessions: only a SHA-256 of the token is stored, so a database
// leak does not expose usable tokens, and sessions can be revoked individually.
const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String, maxlength: 300 },
    // TTL index: MongoDB removes the document once this date passes.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
)

export const Session = mongoose.model('Session', sessionSchema)
