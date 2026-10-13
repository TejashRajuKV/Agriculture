import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

// CropPrice Model
const CropPrice = mongoose.model('CropPrice', new mongoose.Schema({
  crop: String,
  mandi: String,
  price: Number,
  date: Date,
  category: String,
  msp: Number
}));

// Helper functions
const calculateTrend = (current, previous) => {
  const change = ((current - previous) / previous) * 100;
  return change > 2 ? 'UP' : change < -2 ? 'DOWN' : 'STABLE';
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server running' });
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
      return res.json({ success: false, message: 'No data' });
    }
    
    const current = priceData[0].price;
    const previous = priceData.length > 1 ? priceData[1].price : current;
    const percentageChange = ((current - previous) / previous) * 100;
    const trend = calculateTrend(current, previous);
    
    res.json({
      success: true,
      data: {
        crop,
        price: current,
        yesterdayPrice: previous,
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
  console.log(`✅ Simple server running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Crops: http://localhost:${PORT}/api/market/crops`);
});