import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    // Login identifier: lowercase letters, digits, "." "_" "-" (validated at the API).
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    // scrypt output; never returned by default queries.
    passwordHash: { type: String, required: true, select: false },
    passwordSalt: { type: String, required: true, select: false },
  },
  { timestamps: true },
)

userSchema.methods.toPublic = function toPublic() {
  return { id: this.id, username: this.username, displayName: this.displayName }
}

export const User = mongoose.model('User', userSchema)
