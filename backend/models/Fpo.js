import mongoose from 'mongoose';

// Farmer Producer Organisation
const fpoSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    registrationNumber: { type: String, required: true, unique: true },
    contactPerson: String,
    phone: String,
    location: String,
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    members: [
      {
        farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        joinedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model('Fpo', fpoSchema);
