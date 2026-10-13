import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CropPrice from './models/CropPrice.js';

dotenv.config();

const checkDatabase = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if there's any data
    const totalRecords = await CropPrice.countDocuments();
    console.log(`📊 Total crop price records: ${totalRecords}`);

    if (totalRecords === 0) {
      console.log('❌ No data found in database!');
      console.log('💡 You need to seed some data first.');
      
      // Add some sample data
      console.log('🌱 Adding sample crop data...');
      const sampleData = [
        { crop: 'Wheat', mandi: 'Delhi', price: 2500, date: new Date() },
        { crop: 'Rice', mandi: 'Punjab', price: 3200, date: new Date() },
        { crop: 'Maize', mandi: 'Haryana', price: 1800, date: new Date() },
        { crop: 'Sugarcane', mandi: 'UP', price: 350, date: new Date() },
        { crop: 'Cotton', mandi: 'Gujarat', price: 6500, date: new Date() }
      ];

      await CropPrice.insertMany(sampleData);
      console.log('✅ Sample data added successfully!');
    } else {
      // Show available crops
      const crops = await CropPrice.distinct('crop');
      console.log(`📋 Available crops: ${crops.join(', ')}`);
      
      // Show latest prices
      console.log('💰 Latest prices:');
      for (const crop of crops.slice(0, 5)) {
        const latest = await CropPrice.findOne({ crop }).sort({ date: -1 });
        console.log(`  ${crop}: ₹${latest.price} (${latest.mandi})`);
      }
    }

    await mongoose.disconnect();
    console.log('✅ Database check complete');
  } catch (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  }
};

checkDatabase();