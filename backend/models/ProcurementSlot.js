import mongoose from 'mongoose';

const procurementSlotSchema = new mongoose.Schema(
  {
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementCenter', required: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD' (IST)
    startTime: { type: String, required: true }, // 'HH:MM'
    endTime: { type: String, required: true },
    capacity: { type: Number, required: true, min: 0 },
    bookedCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['OPEN', 'CLOSED', 'CANCELLED'], default: 'OPEN' }
  },
  { timestamps: true }
);

// One slot per centre/date/start; makes lazy slot generation idempotent
procurementSlotSchema.index({ center: 1, date: 1, startTime: 1 }, { unique: true });

export default mongoose.model('ProcurementSlot', procurementSlotSchema);
