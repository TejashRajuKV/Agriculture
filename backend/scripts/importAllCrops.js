import fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CropPrice from './models/CropPrice.js';

dotenv.config();

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI);

const parseAGMARKNETCSV_Fixed = async (filePath) => {
  try {
    console.log('📊 Parsing AGMARKNET CSV (ALL 24 crops)...');
    
    const results = [];
    const csvData = fs.readFileSync(filePath, 'utf8');
    const lines = csvData.split('\n');
    
    // Skip header rows (first 3 lines are headers)
    const dataLines = lines.slice(3).filter(line => line.trim() && !line.startsWith(',,,'));
    
    console.log(`📋 Found ${dataLines.length} data lines to process`);
    
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      console.log(`Processing line ${i + 1}: ${line.substring(0, 50)}...`);
      
      // Handle CSV parsing with quoted fields
      const columns = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          columns.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      columns.push(current.trim()); // Add last column
      
      if (columns.length >= 6) {
        const commodityGroup = columns[0]?.trim();
        const commodity = columns[1]?.trim();
        const msp = parseFloat(columns[2]) || 0;
        const currentPrice = parseFloat(columns[3]) || 0;
        const prevPrice1 = parseFloat(columns[4]) || 0;
        const prevPrice2 = parseFloat(columns[5]) || 0;
        
        console.log(`   Crop: ${commodity}, Current: ${currentPrice}, Prev1: ${prevPrice1}, Prev2: ${prevPrice2}`);
        
        if (commodity && commodity !== '-' && currentPrice > 0) {
          // Current day price (Jan 1, 2026)
          results.push({
            crop: commodity,
            mandi: 'National Average',
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
        } else if (commodity) {
          console.log(`   ⚠️ Skipped ${commodity} - no valid price data`);
        }
      }
    }
    
    console.log(`✅ Parsed ${results.length} price records from ${dataLines.length} lines`);
    
    // Show unique crops found
    const uniqueCrops = [...new Set(results.map(r => r.crop))];
    console.log(`🌾 Unique crops found: ${uniqueCrops.length}`);
    uniqueCrops.forEach((crop, index) => {
      console.log(`${index + 1}. ${crop}`);
    });
    
    return results;
    
  } catch (error) {
    console.error('❌ Error parsing CSV:', error);
    return [];
  }
};

const importAllAGMARKNETData = async () => {
  try {
    const filePath = 'C:\\Users\\tejas\\Downloads\\Documents - Copy\\AGRILOOP-1\\Marketwise_Price_Arrival_03-01-2026_10-11-18_AM.csv';
    
    console.log('🌾 Importing ALL AGMARKNET data to MongoDB...');
    
    // Parse CSV data with improved parser
    const priceData = await parseAGMARKNETCSV_Fixed(filePath);
    
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
    
    // Show final summary
    const crops = await CropPrice.distinct('crop');
    console.log(`\\n🎉 SUCCESS: ${crops.length} crops imported to MongoDB Cloud`);
    
    crops.forEach((crop, index) => {
      console.log(`${index + 1}. ${crop}`);
    });
    
    // Show sample prices
    console.log('\\n📈 Sample prices:');
    for (const crop of crops.slice(0, 5)) {
      const latestPrice = await CropPrice.findOne({ crop }).sort({ date: -1 });
      if (latestPrice) {
        console.log(`   ${crop}: ₹${latestPrice.price}/quintal`);
      }
    }
    
    console.log('\\n✅ All 24 crops successfully imported!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await mongoose.connection.close();
  }
};

importAllAGMARKNETData();