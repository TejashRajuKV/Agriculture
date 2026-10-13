import mongoose from 'mongoose';

// A reminder the farmer set for a government scheme. Dates are chosen by the farmer, never assumed.
const schemeReminderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    schemeId: { type: String, required: true },
    remindOn: { type: String, required: true }, // 'YYYY-MM-DD'
    note: String,
    sentAt: Date
  },
  { timestamps: true }
);
schemeReminderSchema.index({ sentAt: 1, remindOn: 1 });

export default mongoose.model('SchemeReminder', schemeReminderSchema);
