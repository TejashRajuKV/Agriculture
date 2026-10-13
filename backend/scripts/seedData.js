import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI);

// CropPrice Model
const cropPriceSchema = new mongoose.Schema({
  crop: { type: String, required: true, trim: true },
  mandi: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true, default: Date.now }
}, { timestamps: true });

const CropPrice = mongoose.model('CropPrice', cropPriceSchema);

// Sample data for last 7 days
const sampleData = [
  // Wheat prices for last 7 days
  { crop: 'Wheat', mandi: 'Delhi', price: 2000, date: new Date('2024-01-15') },
  { crop: 'Wheat', mandi: 'Delhi', price: 2050, date: new Date('2024-01-16') },
  { crop: 'Wheat', mandi: 'Delhi', price: 2080, date: new Date('2024-01-17') },
  { crop: 'Wheat', mandi: 'Delhi', price: 2120, date: new Date('2024-01-18') },
  { crop: 'Wheat', mandi: 'Delhi', price: 2100, date: new Date('2024-01-19') },
  { crop: 'Wheat', mandi: 'Delhi', price: 2100, date: new Date('2024-01-20') },
  { crop: 'Wheat', mandi: 'Delhi', price: 2150, date: new Date('2024-01-21') },
  
  // Rice prices for last 7 days
  { crop: 'Rice', mandi: 'Punjab', price: 1950, date: new Date('2024-01-15') },
  { crop: 'Rice', mandi: 'Punjab', price: 1920, date: new Date('2024-01-16') },
  { crop: 'Rice', mandi: 'Punjab', price: 1900, date: new Date('2024-01-17') },
  { crop: 'Rice', mandi: 'Punjab', price: 1880, date: new Date('2024-01-18') },
  { crop: 'Rice', mandi: 'Punjab', price: 1900, date: new Date('2024-01-19') },
  { crop: 'Rice', mandi: 'Punjab', price: 1900, date: new Date('2024-01-20') },
  { crop: 'Rice', mandi: 'Punjab', price: 1850, date: new Date('2024-01-21') },
  
  // Maize prices for last 7 days
  { crop: 'Maize', mandi: 'Karnataka', price: 1720, date: new Date('2024-01-15') },
  { crop: 'Maize', mandi: 'Karnataka', price: 1730, date: new Date('2024-01-16') },
  { crop: 'Maize', mandi: 'Karnataka', price: 1740, date: new Date('2024-01-17') },
  { crop: 'Maize', mandi: 'Karnataka', price: 1750, date: new Date('2024-01-18') },
  { crop: 'Maize', mandi: 'Karnataka', price: 1740, date: new Date('2024-01-19') },
  { crop: 'Maize', mandi: 'Karnataka', price: 1740, date: new Date('2024-01-20') },
  { crop: 'Maize', mandi: 'Karnataka', price: 1750, date: new Date('2024-01-21') }
];

async function seedDatabase() {
  try {
    console.log('🌱 Seeding MongoDB with crop market data...');
    
    // Clear existing data
    await CropPrice.deleteMany({});
    console.log('🗑️ Cleared existing data');
    
    // Insert sample data
    await CropPrice.insertMany(sampleData);
    console.log('✅ Sample data inserted successfully!');
    
    // Verify data
    const count = await CropPrice.countDocuments();
    console.log(`📊 Total records in database: ${count}`);
    
    // Show crops available
    const crops = await CropPrice.distinct('crop');
    console.log(`🌾 Available crops: ${crops.join(', ')}`);
    
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    mongoose.connection.close();
  }
}

seedDatabase();