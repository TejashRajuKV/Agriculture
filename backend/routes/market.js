import express from 'express';
import CropPrice from '../models/CropPrice.js';
import { analyzeCropTrend, formatPriceChange } from '../services/trendService.js';

const router = express.Router();

// GET /api/market/crops - List available crops
router.get('/crops', async (req, res) => {
  try {
    const crops = await CropPrice.distinct('crop');
    
    res.json({
      success: true,
      data: crops
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching crops',
      error: error.message
    });
  }
});

// GET /api/market/:crop - Get crop market data (stock-like response)
router.get('/:crop', async (req, res) => {
  try {
    const { crop } = req.params;
    
    // Get all available data for this crop (last 7 days)
    const priceHistory = await CropPrice.find({
      crop: crop
    }).sort({ date: -1 }).limit(7);
    
    if (priceHistory.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No price data found for ${crop}`
      });
    }
    
    // Sort by date (latest first for trend calculation)
    const sortedHistory = priceHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Get current and previous prices
    const currentPrice = sortedHistory[0].price;
    const previousPrice = sortedHistory.length > 1 ? sortedHistory[1].price : currentPrice;
    
    // Analyze trend (core intelligence)
    const analysis = analyzeCropTrend(sortedHistory);
    
    // Format last 7 days for chart (chronological order)
    const chartData = sortedHistory
      .reverse() // Reverse to get chronological order
      .map(record => ({
        date: record.date.toISOString().split('T')[0],
        price: record.price
      }));
    
    // Stock-like response format
    const response = {
      success: true,
      data: {
        crop: crop,
        mandi: sortedHistory[0].mandi || 'National Average',
        price: currentPrice,
        trend: analysis.trend,
        change: formatPriceChange(analysis.percentageChange),
        percentageChange: analysis.percentageChange,
        suggestion: analysis.suggestion,
        prices: chartData,
        currentPrice: currentPrice,
        yesterdayPrice: previousPrice,
        last7Days: chartData,
        lastUpdated: sortedHistory[0].date
      }
    };
    
    res.json(response);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching crop data',
      error: error.message
    });
  }
});

// GET /api/market/:crop/mandis - Get available mandis for a crop
router.get('/:crop/mandis', async (req, res) => {
  try {
    const { crop } = req.params;
    
    const mandis = await CropPrice.distinct('mandi', { crop: crop });
    
    res.json({
      success: true,
      data: mandis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching mandis',
      error: error.message
    });
  }
});

// POST /api/market/price - Add new price data
router.post('/price', async (req, res) => {
  try {
    const priceData = new CropPrice(req.body);
    await priceData.save();
    
    res.json({
      success: true,
      message: 'Price data added successfully',
      data: priceData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding price data',
      error: error.message
    });
  }
});

export default router;