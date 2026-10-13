import mongoose from 'mongoose';

export const VehicleTypes = ['PICKUP', 'MINI_TRUCK', 'TRUCK'];
export const VehicleStatus = ['AVAILABLE', 'ON_ROUTE', 'MAINTENANCE'];
export const DeliveryStatus = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const vehicleSchema = new mongoose.Schema(
  {
    operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    plate: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: VehicleTypes, required: true },
    capacityKg: { type: Number, required: true, min: 1 },
    status: { type: String, enum: VehicleStatus, default: 'AVAILABLE' },
    base: { label: String, lat: Number, lng: Number }
  },
  { timestamps: true }
);

const stopSchema = new mongoose.Schema(
  {
    sequence: { type: Number, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: String,
    type: { type: String, enum: ['PICKUP', 'DROP'], required: true },
    label: String,
    lat: Number,
    lng: Number,
    kg: Number,
    legKm: Number,
    etaMinutes: Number,
    loadAfterKg: Number,
    status: { type: String, enum: ['PENDING', 'DONE'], default: 'PENDING' },
    doneAt: Date
  },
  { _id: false }
);

// One vehicle run carrying one or more orders from sellers to buyers
const deliverySchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true }, // DL-2026-00001
    operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    vehicleName: String,
    plate: String,
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    status: { type: String, enum: DeliveryStatus, default: 'PLANNED' },
    start: { label: String, lat: Number, lng: Number },
    stops: [stopSchema],
    totalKm: Number,
    naiveKm: Number,
    savedKm: Number,
    durationMinutes: Number,
    peakLoadKg: Number,
    capacityKg: Number,
    startedAt: Date,
    completedAt: Date
  },
  { timestamps: true }
);
deliverySchema.index({ operator: 1, date: -1 });
deliverySchema.index({ 'stops.order': 1 });

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export const Delivery = mongoose.model('Delivery', deliverySchema);
