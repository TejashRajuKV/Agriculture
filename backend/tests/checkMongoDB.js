import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CropPrice from './models/CropPrice.js';

dotenv.config();

async function checkMongoDBData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Cloud');
    
    // Get all crops in database
    const crops = await CropPrice.distinct('crop');
    console.log(`\n📊 Current crops in MongoDB: ${crops.length}`);
    crops.forEach((crop, index) => {
      console.log(`${index + 1}. ${crop}`);
    });
    
    // Get sample data for each crop
    console.log('\n📈 Sample prices:');
    for (const crop of crops.slice(0, 5)) {
      const latestPrice = await CropPrice.findOne({ crop }).sort({ date: -1 });
      if (latestPrice) {
        console.log(`   ${crop}: ₹${latestPrice.price}/quintal (${latestPrice.date.toDateString()})`);
      }
    }
    
    // Count total records
    const totalRecords = await CropPrice.countDocuments();
    console.log(`\n📋 Total price records: ${totalRecords}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkMongoDBData();