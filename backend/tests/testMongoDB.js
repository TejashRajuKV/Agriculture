import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CropPrice from './models/CropPrice.js';

dotenv.config();

async function testMongoDBCloud() {
  try {
    console.log('🔌 Testing MongoDB Cloud connection...');
    console.log('📍 Connection URI:', process.env.MONGODB_URI.replace(/\/\/.*@/, '//***:***@'));
    
    // Connect to MongoDB Cloud
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Cloud connected successfully!');
    
    // Test 1: Insert sample data
    console.log('\n📝 Test 1: Inserting sample data...');
    const testData = {
      crop: 'TestWheat',
      mandi: 'TestDelhi',
      price: 2500,
      date: new Date()
    };
    
    const savedData = await CropPrice.create(testData);
    console.log('✅ Data inserted:', savedData._id);
    
    // Test 2: Fetch the inserted data
    console.log('\n📖 Test 2: Fetching inserted data...');
    const fetchedData = await CropPrice.findById(savedData._id);
    console.log('✅ Data fetched:', {
      crop: fetchedData.crop,
      mandi: fetchedData.mandi,
      price: fetchedData.price,
      date: fetchedData.date
    });
    
    // Test 3: Count total documents
    console.log('\n📊 Test 3: Counting total documents...');
    const totalCount = await CropPrice.countDocuments();
    console.log('✅ Total documents in collection:', totalCount);
    
    // Test 4: Get distinct crops
    console.log('\n🌾 Test 4: Getting available crops...');
    const crops = await CropPrice.distinct('crop');
    console.log('✅ Available crops:', crops);
    
    // Test 5: Get last 7 days data for a crop
    console.log('\n📈 Test 5: Getting 7-day data...');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const weekData = await CropPrice.find({
      crop: { $in: crops },
      date: { $gte: sevenDaysAgo }
    }).sort({ date: -1 }).limit(5);
    
    console.log('✅ Recent data (last 5 records):');
    weekData.forEach(record => {
      console.log(`   ${record.crop} - ₹${record.price} (${record.date.toDateString()})`);
    });
    
    // Test 6: Clean up test data
    console.log('\n🧹 Test 6: Cleaning up test data...');
    await CropPrice.deleteOne({ _id: savedData._id });
    console.log('✅ Test data cleaned up');
    
    // Final status
    console.log('\n🎉 All MongoDB Cloud tests passed!');
    console.log('💾 Database:', mongoose.connection.name);
    console.log('🏠 Host:', mongoose.connection.host);
    console.log('📊 Total collections:', Object.keys(mongoose.connection.collections).length);
    
  } catch (error) {
    console.error('❌ MongoDB Cloud test failed:', error.message);
    
    if (error.message.includes('authentication')) {
      console.error('🔐 Authentication issue - check username/password');
    } else if (error.message.includes('network')) {
      console.error('🌐 Network issue - check internet connection');
    } else if (error.message.includes('timeout')) {
      console.error('⏰ Connection timeout - check MongoDB Atlas status');
    }
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connection closed');
  }
}

testMongoDBCloud();