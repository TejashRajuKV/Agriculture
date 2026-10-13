import CropPrice from '../models/CropPrice.js';

// Simulated AGMARKNET data fetcher
// In production, this would fetch from actual AGMARKNET CSV/API

const SAMPLE_CROPS = ['Wheat', 'Rice', 'Maize', 'Tomato', 'Onion', 'Potato'];
const SAMPLE_MANDIS = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Kolkata', 'Hyderabad'];

// Generate realistic price variations
const generatePrice = (basePrices, crop, previousPrice = null) => {
  const basePrice = basePrices[crop] || 2000;
  
  if (!previousPrice) {
    return basePrice + Math.random() * 500 - 250; // ±250 variation
  }
  
  // Stock-like price movement (±5% daily variation)
  const variation = (Math.random() - 0.5) * 0.1; // ±5%
  const newPrice = previousPrice * (1 + variation);
  
  return Math.max(newPrice, basePrice * 0.5); // Don't go below 50% of base
};

const BASE_PRICES = {
  'Wheat': 2100,
  'Rice': 1900,
  'Maize': 1750,
  'Tomato': 2500,
  'Onion': 1800,
  'Potato': 1600
};

// Simulate daily price fetch job
export const fetchDailyPrices = async () => {
  try {
    console.log('🔄 Fetching daily prices (simulated AGMARKNET)...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const newPrices = [];
    
    for (const crop of SAMPLE_CROPS) {
      for (const mandi of SAMPLE_MANDIS.slice(0, 2)) { // 2 mandis per crop
        
        // Get yesterday's price for realistic variation
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const lastPrice = await CropPrice.findOne({
          crop,
          mandi,
          date: yesterday
        });
        
        const price = generatePrice(BASE_PRICES, crop, lastPrice?.price);
        
        newPrices.push({
          crop,
          mandi,
          price: Math.round(price),
          date: today
        });
      }
    }
    
    // Insert today's prices
    await CropPrice.insertMany(newPrices);
    
    console.log(`✅ Inserted ${newPrices.length} price records for ${today.toDateString()}`);
    
    return newPrices;
    
  } catch (error) {
    console.error('❌ Error fetching daily prices:', error);
    throw error;
  }
};

// Seed historical data (7 days)
export const seedHistoricalData = async () => {
  try {
    console.log('🌱 Seeding historical price data...');
    
    // Clear existing data
    await CropPrice.deleteMany({});
    
    const historicalData = [];
    
    // Generate 7 days of historical data
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      for (const crop of SAMPLE_CROPS) {
        for (const mandi of SAMPLE_MANDIS.slice(0, 2)) {
          
          // Get previous day's price for realistic progression
          const previousPrice = historicalData
            .filter(d => d.crop === crop && d.mandi === mandi)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.price;
          
          const price = generatePrice(BASE_PRICES, crop, previousPrice);
          
          historicalData.push({
            crop,
            mandi,
            price: Math.round(price),
            date: date
          });
        }
      }
    }
    
    await CropPrice.insertMany(historicalData);
    
    console.log(`✅ Seeded ${historicalData.length} historical records`);
    console.log(`📊 Crops: ${SAMPLE_CROPS.join(', ')}`);
    console.log(`🏪 Mandis: ${SAMPLE_MANDIS.slice(0, 2).join(', ')}`);
    
    return historicalData;
    
  } catch (error) {
    console.error('❌ Error seeding historical data:', error);
    throw error;
  }
};

// Schedule daily job (in production, use cron)
export const startDailyPriceJob = () => {
  console.log('⏰ Starting daily price fetch job...');
  
  // Run every 24 hours (86400000 ms)
  setInterval(async () => {
    try {
      await fetchDailyPrices();
    } catch (error) {
      console.error('❌ Daily price job failed:', error);
    }
  }, 86400000);
  
  console.log('✅ Daily price job scheduled');
};