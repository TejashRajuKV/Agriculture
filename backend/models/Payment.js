import mongoose from 'mongoose';

export const PaymentStatus = ['PENDING', 'PROCESSING', 'PAID', 'FAILED'];

const paymentSchema = new mongoose.Schema(
  {
    procurement: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementRecord', required: true, unique: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementCenter', required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, default: 'BANK_TRANSFER' },
    provider: { type: String, default: 'SIMULATED' },
    status: { type: String, enum: PaymentStatus, default: 'PENDING' },
    transactionRef: String,
    failureReason: String,
    // Why a payment is late or failed, chosen from a fixed list so the farmer is told what to do
    delayCode: String,
    delayNote: String,
    delayAt: Date,
    processingAt: Date,
    paidAt: Date
  },
  { timestamps: true }
);

export default mongoose.model('Payment', paymentSchema);
