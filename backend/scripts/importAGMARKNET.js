import fs from 'fs';
import csv from 'csv-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CropPrice from './models/CropPrice.js';

dotenv.config();

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI);

const parseAGMARKNETCSV = async (filePath) => {
  try {
    console.log('📊 Parsing AGMARKNET CSV data...');
    
    const results = [];
    const csvData = fs.readFileSync(filePath, 'utf8');
    const lines = csvData.split('\n');
    
    // Skip header rows (first 3 lines are headers)
    const dataLines = lines.slice(3).filter(line => line.trim());
    
    for (const line of dataLines) {
      const columns = line.split(',');
      
      if (columns.length >= 9 && columns[1] && columns[3]) {
        const commodityGroup = columns[0]?.trim();
        const commodity = columns[1]?.trim();
        const msp = parseFloat(columns[2]) || 0;
        const currentPrice = parseFloat(columns[3]) || 0;
        const prevPrice1 = parseFloat(columns[4]) || 0;
        const prevPrice2 = parseFloat(columns[5]) || 0;
        
        if (commodity && currentPrice > 0) {
          // Current day price
          results.push({
            crop: commodity,
            mandi: 'National Average', // AGMARKNET gives national data
            price: currentPrice,
            date: new Date('2026-01-01'),
            msp: msp,
            category: commodityGroup
          });
          
          // Previous day prices for trend calculation
          if (prevPrice1 > 0) {
            results.push({
              crop: commodity,
              mandi: 'National Average',
              price: prevPrice1,
              date: new Date('2025-12-31'),
              msp: msp,
              category: commodityGroup
            });
          }
          
          if (prevPrice2 > 0) {
            results.push({
              crop: commodity,
              mandi: 'National Average',
              price: prevPrice2,
              date: new Date('2025-12-30'),
              msp: msp,
              category: commodityGroup
            });
          }
        }
      }
    }
    
    console.log(`✅ Parsed ${results.length} price records`);
    return results;
    
  } catch (error) {
    console.error('❌ Error parsing CSV:', error);
    return [];
  }
};

const importAGMARKNETData = async () => {
  try {
    const filePath = 'C:\\Users\\tejas\\Downloads\\Documents - Copy\\AGRILOOP-1\\Marketwise_Price_Arrival_03-01-2026_10-11-18_AM.csv';
    
    console.log('🌾 Importing AGMARKNET data to MongoDB...');
    
    // Parse CSV data
    const priceData = await parseAGMARKNETCSV(filePath);
    
    if (priceData.length === 0) {
      console.log('❌ No valid data found in CSV');
      return;
    }
    
    // Clear existing data
    await CropPrice.deleteMany({});
    console.log('🗑️ Cleared existing price data');
    
    // Insert new AGMARKNET data
    await CropPrice.insertMany(priceData);
    console.log(`✅ Imported ${priceData.length} AGMARKNET price records`);
    
    // Show summary
    const crops = await CropPrice.distinct('crop');
    console.log(`🌾 Available crops: ${crops.length}`);
    console.log(`📊 Crops: ${crops.slice(0, 10).join(', ')}${crops.length > 10 ? '...' : ''}`);
    
    // Show sample data
    console.log('\\n📈 Sample price data:');
    const sampleData = await CropPrice.find().limit(5);
    sampleData.forEach(record => {
      console.log(`   ${record.crop}: ₹${record.price}/quintal (${record.date.toDateString()})`);
    });
    
    console.log('\\n🎉 AGMARKNET data import completed!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await mongoose.connection.close();
  }
};

importAGMARKNETData();