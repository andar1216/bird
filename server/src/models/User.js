import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    // scrypt output; never returned by default queries.
    passwordHash: { type: String, required: true, select: false },
    passwordSalt: { type: String, required: true, select: false },
  },
  { timestamps: true },
)

userSchema.methods.toPublic = function toPublic() {
  return { id: this.id, email: this.email, displayName: this.displayName }
}

export const User = mongoose.model('User', userSchema)
