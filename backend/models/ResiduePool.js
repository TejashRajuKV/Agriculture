import mongoose from 'mongoose';

export const PoolStatus = ['OPEN', 'RESERVED', 'COLLECTED', 'CANCELLED'];

const memberSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    tonnes: { type: Number, required: true, min: 0.1 }
  },
  { _id: false }
);

const poolBidSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyerName: String,
    pricePerTon: { type: Number, required: true, min: 1 },
    pickupDate: String,
    message: String,
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' }
  },
  { timestamps: true }
);

// Neighbours pool their straw into one big lot so a baler or biogas plant finds it worth a trip.
const poolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    residue: { type: String, required: true, trim: true }, // e.g. 'Paddy straw'
    village: String,
    district: { type: String, required: true },
    state: { type: String, required: true },
    minTonnes: { type: Number, required: true, min: 1 },
    deadline: { type: String, required: true }, // 'YYYY-MM-DD', last day to join
    coordinator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coordinatorName: String,
    members: [memberSchema],
    lockedMembers: [memberSchema], // snapshot taken when a bid is accepted; payout uses this
    bids: [poolBidSchema],
    acceptedBid: mongoose.Schema.Types.ObjectId,
    status: { type: String, enum: PoolStatus, default: 'OPEN' },
    completedAt: Date
  },
  { timestamps: true }
);
poolSchema.index({ status: 1, state: 1, district: 1 });

export default mongoose.model('ResiduePool', poolSchema);
