import mongoose from 'mongoose';

export const ProcurementStatus = [
  'WAITING',
  'WEIGHING',
  'QUALITY_CHECK',
  'ACCEPTED',
  'PARTIALLY_ACCEPTED',
  'REJECTED',
  'COMPLETED'
];

export const QualityGrades = ['A', 'B', 'C', 'REJECT'];

const procurementRecordSchema = new mongoose.Schema(
  {
    recordNumber: { type: String, required: true, unique: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementBooking', required: true, unique: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementCenter', required: true },
    crop: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop', required: true },
    date: { type: String, required: true }, // procurement day, 'YYYY-MM-DD'
    declaredQuantity: { type: Number, required: true }, // kg, as booked
    weighedQuantity: Number, // kg on the scale
    acceptedQuantity: Number,
    rejectedQuantity: Number,
    qualityGrade: { type: String, enum: QualityGrades },
    qualityNotes: String,
    pricePerKg: Number,
    totalAmount: Number,
    status: { type: String, enum: ProcurementStatus, default: 'WEIGHING' },
    startedAt: Date, // weighing began
    weighedAt: Date, // weight recorded -> quality check
    qualityCheckedAt: Date, // grade + decision recorded
    completedAt: Date,
    processingMinutes: Number, // startedAt -> completedAt; feeds the wait-time estimate
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

procurementRecordSchema.index({ center: 1, completedAt: -1 });
procurementRecordSchema.index({ center: 1, date: 1 });

export default mongoose.model('ProcurementRecord', procurementRecordSchema);
