import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 5001; // Use different port to avoid conflicts

app.use(cors());
app.use(express.json());

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI);

// Simple CropPrice model
const CropPrice = mongoose.model('CropPrice', new mongoose.Schema({
  crop: String,
  mandi: String,
  price: Number,
  date: Date
}));

// Test routes
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Test server running' });
});

app.get('/api/market/crops', async (req, res) => {
  try {
    const crops = await CropPrice.distinct('crop');
    res.json({ success: true, data: crops });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/market/:crop', async (req, res) => {
  try {
    const { crop } = req.params;
    const priceData = await CropPrice.find({ crop }).sort({ date: -1 }).limit(3);
    
    if (priceData.length === 0) {
      return res.json({ success: false, message: 'No data found' });
    }
    
    const currentPrice = priceData[0].price;
    const previousPrice = priceData.length > 1 ? priceData[1].price : currentPrice;
    const percentageChange = ((currentPrice - previousPrice) / previousPrice) * 100;
    const trend = percentageChange > 2 ? 'UP' : percentageChange < -2 ? 'DOWN' : 'STABLE';
    
    res.json({
      success: true,
      data: {
        crop,
        price: currentPrice,
        yesterdayPrice: previousPrice,
        trend,
        percentageChange,
        last7Days: priceData.map(p => ({ date: p.date, price: p.price }))
      }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🧪 Test server running on port ${PORT}`);
  console.log(`🔗 Test: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Crops: http://localhost:${PORT}/api/market/crops`);
  console.log(`🔗 Wheat: http://localhost:${PORT}/api/market/Wheat`);
});