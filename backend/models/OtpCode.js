import mongoose from 'mongoose';

// One row per OTP request. Only a keyed hash of the code is stored, never the code itself.
const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    usedAt: Date
  },
  { timestamps: true }
);
// Rows disappear on their own an hour after they expire
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export default mongoose.model('OtpCode', otpSchema);
