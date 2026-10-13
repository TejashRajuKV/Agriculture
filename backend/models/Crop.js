import mongoose from 'mongoose';

const cropSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    category: { type: String, enum: ['VEGETABLE', 'CEREAL', 'PULSE', 'OILSEED', 'FIBRE', 'FRUIT', 'OTHER'], required: true },
    unit: { type: String, default: 'kg' },
    // Commodity name in the AGMARKNET price report (for mandi reference prices)
    agmarknetName: String,
    image: String
  },
  { timestamps: true }
);

export default mongoose.model('Crop', cropSchema);
