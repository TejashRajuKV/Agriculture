import mongoose from 'mongoose';

export const MachineTypes = ['TRACTOR', 'BALER', 'COMBINE_HARVESTER', 'HAPPY_SEEDER', 'ROTAVATOR', 'SPRAYER', 'OTHER'];
export const RateUnits = ['PER_HOUR', 'PER_ACRE', 'PER_DAY'];
export const MachineBookingStatus = ['REQUESTED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED'];

// Farm machinery owned by a farmer or FPO that neighbours can book by the day.
// Payment is settled directly between the two people; AgriLoop only handles the dates.
const machineSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ownerName: String,
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: MachineTypes, required: true },
    rate: { type: Number, required: true, min: 0 },
    rateUnit: { type: String, enum: RateUnits, required: true },
    district: { type: String, required: true },
    state: { type: String, required: true },
    description: String,
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);
machineSchema.index({ state: 1, district: 1, type: 1, active: 1 });

const bookingSchema = new mongoose.Schema(
  {
    machine: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    renter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    renterName: String,
    machineName: String,
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    quantity: { type: Number, required: true, min: 0.5 }, // hours, acres or days, per the machine's rate unit
    rate: Number,
    rateUnit: String,
    estimatedTotal: Number,
    note: String,
    status: { type: String, enum: MachineBookingStatus, default: 'REQUESTED' }
  },
  { timestamps: true }
);
// A machine can only be accepted for one renter per day
bookingSchema.index({ machine: 1, date: 1 }, { unique: true, partialFilterExpression: { status: 'ACCEPTED' } });
bookingSchema.index({ renter: 1, createdAt: -1 });
bookingSchema.index({ owner: 1, createdAt: -1 });

export const Machine = mongoose.model('Machine', machineSchema);
export const MachineBooking = mongoose.model('MachineBooking', bookingSchema);
