import mongoose from 'mongoose';

const procurementCenterSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g. M01 (used in tokens)
    name: { type: String, required: true, trim: true },
    address: String,
    district: String,
    state: String,
    lat: Number,
    lng: Number,
    openingTime: { type: String, required: true }, // 'HH:MM' IST
    closingTime: { type: String, required: true },
    slotMinutes: { type: Number, default: 30, min: 10 },
    counters: { type: Number, default: 1, min: 1 }, // weighing/quality desks working in parallel
    avgProcessingMinutes: { type: Number, default: 6, min: 1 }, // fallback until there is history
    dailyCapacity: { type: Number, required: true, min: 1 }, // farmers per day
    status: { type: String, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE' },
    crops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Crop' }],
    // Procurement price offered per crop (₹/kg); managers can override per record
    // maxMoisturePct: moisture above this is likely to be rejected or discounted (set by the centre)
    cropPrices: [
      {
        crop: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop' },
        pricePerKg: Number,
        maxMoisturePct: Number
      }
    ],
    pricesUpdatedAt: Date,
    managers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

export default mongoose.model('ProcurementCenter', procurementCenterSchema);
