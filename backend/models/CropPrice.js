import mongoose from 'mongoose';

const cropPriceSchema = new mongoose.Schema({
  crop: {
    type: String,
    required: true,
    trim: true
  },
  mandi: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for performance (stock-like queries)
cropPriceSchema.index({ crop: 1, date: -1 });
cropPriceSchema.index({ mandi: 1, date: -1 });
cropPriceSchema.index({ crop: 1, mandi: 1, date: -1 });

export default mongoose.model('CropPrice', cropPriceSchema);