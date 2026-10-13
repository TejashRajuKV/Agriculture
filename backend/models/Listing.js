import mongoose from 'mongoose';

// HOUSEHOLD = a household's waste pickup request that a biogas plant can claim (see wasteService.js).
// It never appears in the produce/residue marketplace listings.
export const ListingKinds = ['PRODUCE', 'RESIDUE', 'HOUSEHOLD'];
export const ListingStatus = [
  'DRAFT',
  'ACTIVE',
  'RESERVED', // residue: bid accepted, waiting for pickup
  'SOLD_OUT',
  'EXPIRED',
  'CANCELLED'
];
export const BidStatus = ['PENDING', 'ACCEPTED', 'REJECTED'];

const bidSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyerName: String,
    pricePerTon: { type: Number, required: true, min: 1 },
    pickupDate: String, // 'YYYY-MM-DD'
    message: String,
    status: { type: String, enum: BidStatus, default: 'PENDING' }
  },
  { timestamps: true }
);

// One marketplace, two kinds:
//  PRODUCE - fixed price per unit, buyers place orders that draw down quantityAvailable
//  RESIDUE - crop residue sold by bidding (bid -> accept -> pickup -> complete)
const listingSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ListingKinds, required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sellerType: { type: String, enum: ['FARMER', 'FPO', 'HOUSEHOLD'], required: true },
    sellerName: String,
    fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo' },
    crop: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop' },
    title: { type: String, required: true, trim: true },
    description: String,
    image: String,
    quantityAvailable: { type: Number, required: true, min: 0 },
    quantityListed: { type: Number, required: true, min: 0 }, // original amount, for "x of y left"
    unit: { type: String, enum: ['kg', 'quintal', 'ton'], default: 'kg' },
    // HOUSEHOLD only
    degradability: { type: String, enum: ['DEGRADABLE', 'NON_DEGRADABLE'] },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    collectedByName: String,
    claimedAt: Date,
    pricePerUnit: { type: Number, min: 0 }, // PRODUCE
    minOrderQuantity: { type: Number, min: 0, default: 1 },
    harvestDate: String,
    qualityGrade: { type: String, enum: ['A', 'B', 'C', 'UNGRADED'], default: 'UNGRADED' },
    location: { label: String, lat: Number, lng: Number },
    status: { type: String, enum: ListingStatus, default: 'ACTIVE' },
    // RESIDUE only
    analysis: mongoose.Schema.Types.Mixed, // residue type, price range, CO2 etc. from the on-device scan
    bids: [bidSchema],
    acceptedBid: { type: mongoose.Schema.Types.ObjectId },
    completedAt: Date
  },
  { timestamps: true }
);

listingSchema.index({ kind: 1, status: 1, createdAt: -1 });
listingSchema.index({ seller: 1, createdAt: -1 });
listingSchema.index({ title: 'text', description: 'text', sellerName: 'text' });

export default mongoose.model('Listing', listingSchema);
