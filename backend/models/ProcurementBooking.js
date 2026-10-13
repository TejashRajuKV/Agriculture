import mongoose from 'mongoose';

export const BookingStatus = ['BOOKED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
export const ArrivalStatus = ['NOT_ARRIVED', 'ARRIVED'];
// NOT_JOINED = booked but not yet checked in at the centre
export const QueueStatus = ['NOT_JOINED', 'WAITING', 'CALLED', 'PROCESSING', 'COMPLETED', 'SKIPPED'];

// A booking owns its queue entry (one per booking) so token and queue state
// are always updated together in a single atomic document write.
const procurementBookingSchema = new mongoose.Schema(
  {
    bookingNumber: { type: String, required: true, unique: true }, // PR-2026-00001
    tokenNumber: { type: String, required: true }, // M01-0928-047
    tokenSeq: { type: Number, required: true }, // 47 - queue order within centre/day
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementCenter', required: true },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementSlot', required: true },
    date: { type: String, required: true }, // copy of slot date for queries
    slotStart: String,
    slotEnd: String,
    crop: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop', required: true },
    estimatedQuantity: { type: Number, required: true, min: 1 }, // kg
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // set when a manager booked on the farmer's behalf
    status: { type: String, enum: BookingStatus, default: 'BOOKED' },
    active: { type: Boolean, default: true }, // false once cancelled/no-show -> frees the one-booking-per-day rule
    arrivalStatus: { type: String, enum: ArrivalStatus, default: 'NOT_ARRIVED' },
    queue: {
      status: { type: String, enum: QueueStatus, default: 'NOT_JOINED' },
      joinedAt: Date,
      calledAt: Date,
      startedAt: Date,
      completedAt: Date
    },
    lastNotifiedAhead: Number // avoids repeating "you're next" notifications
  },
  { timestamps: true }
);

// A farmer can hold only one active booking per centre per day
procurementBookingSchema.index(
  { farmer: 1, center: 1, date: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);
// Tokens are unique per centre/day
procurementBookingSchema.index({ center: 1, date: 1, tokenSeq: 1 }, { unique: true });
procurementBookingSchema.index({ center: 1, date: 1, 'queue.status': 1 });

export default mongoose.model('ProcurementBooking', procurementBookingSchema);
