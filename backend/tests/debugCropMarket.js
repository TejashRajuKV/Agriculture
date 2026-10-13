import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CropPrice from './models/CropPrice.js';

dotenv.config();

async function debugCropMarket() {
  try {
    console.log('🔍 Debugging Crop Market Issue...\n');
    
    // 1. Check MongoDB connection
    console.log('1️⃣ Testing MongoDB connection...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
    
    // 2. Check if crops exist in DB
    console.log('\n2️⃣ Checking crops in database...');
    const crops = await CropPrice.distinct('crop');
    console.log(`✅ Found ${crops.length} crops in DB`);
    console.log('First 5 crops:', crops.slice(0, 5));
    
    // 3. Test crop data retrieval
    console.log('\n3️⃣ Testing crop data retrieval...');
    const wheatData = await CropPrice.find({ crop: 'Wheat' }).sort({ date: -1 });
    console.log(`✅ Wheat records: ${wheatData.length}`);
    if (wheatData.length > 0) {
      console.log('Latest Wheat price:', wheatData[0].price, 'on', wheatData[0].date.toDateString());
    }
    
    // 4. Test trend calculation
    console.log('\n4️⃣ Testing trend calculation...');
    if (wheatData.length >= 2) {
      const current = wheatData[0].price;
      const previous = wheatData[1].price;
      const change = ((current - previous) / previous) * 100;
      const trend = change > 2 ? 'UP' : change < -2 ? 'DOWN' : 'STABLE';
      console.log(`✅ Wheat trend: ${trend} (${change.toFixed(2)}%)`);
    }
    
    // 5. Check server file exists
    console.log('\n5️⃣ Checking server configuration...');
    console.log('MongoDB URI configured:', !!process.env.MONGODB_URI);
    console.log('Port configured:', process.env.PORT || 5000);
    
    console.log('\n✅ All checks passed! Issue might be:');
    console.log('   - Server not running (run: node server.js)');
    console.log('   - Frontend not connecting to localhost:5000');
    console.log('   - CORS issues between frontend and backend');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

debugCropMarket();