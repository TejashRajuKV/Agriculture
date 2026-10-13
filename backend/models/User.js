import mongoose from 'mongoose';

export const Roles = {
  FARMER: 'FARMER',
  FPO: 'FPO',
  BUYER: 'BUYER',
  PROCUREMENT_MANAGER: 'PROCUREMENT_MANAGER',
  LOGISTICS_OPERATOR: 'LOGISTICS_OPERATOR',
  ADMIN: 'ADMIN',
  // existing AgriLoop roles
  HOUSEHOLD: 'HOUSEHOLD',
  BIOGAS: 'BIOGAS',
  LEARNER: 'LEARNER',
  MARKET: 'MARKET'
};

// Roles anyone can sign up for; staff roles are created by seed/admin only
export const SELF_REGISTER_ROLES = [
  Roles.FARMER, Roles.FPO, Roles.BUYER, Roles.HOUSEHOLD, Roles.BIOGAS, Roles.LEARNER, Roles.MARKET
];

export const BuyerTypes = ['INDIVIDUAL', 'RESTAURANT', 'RETAILER', 'PROCESSOR', 'INSTITUTION', 'WHOLESALER'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(Roles), required: true },
    location: {
      label: { type: String, default: '' }, // what the user typed, e.g. "Mandya, Karnataka"
      lat: Number,
      lng: Number
    },
    buyerType: { type: String, enum: BuyerTypes, default: undefined },
    farmerCode: { type: String, unique: true, sparse: true },
    fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo' },
    centerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementCenter' }], // managers
    disabled: { type: Boolean, default: false }, // set by an admin; blocks login and every request
    walletBalance: { type: Number, default: 0 },
    carbonPoints: { type: Number, default: 0 }
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    location: this.location?.label || '',
    buyerType: this.buyerType || null,
    farmerCode: this.farmerCode || null,
    fpo: this.fpo ? String(this.fpo) : null,
    centerIds: (this.centerIds || []).map(String),
    walletBalance: this.walletBalance,
    carbonPoints: this.carbonPoints
  };
};

export default mongoose.model('User', userSchema);
