import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CropPrice from './models/CropPrice.js';

dotenv.config();

const checkData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const count = await CropPrice.countDocuments();
    console.log(`📊 Total records in cropprices: ${count}`);
    
    if (count > 0) {
      const sample = await CropPrice.findOne();
      console.log('📋 Sample record:', sample);
      
      const crops = await CropPrice.distinct('crop');
      console.log('🌾 Available crops:', crops);
    } else {
      console.log('⚠️ No data found. Run seeding...');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

checkData();