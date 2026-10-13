import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CropPrice from './models/CropPrice.js';

dotenv.config();

const expectedCrops = [
  'Bajra(Pearl Millet/Cumbu)',
  'Barley(Jau)',
  'Jowar(Sorghum)',
  'Maize',
  'Paddy(Common)',
  'Ragi(Finger Millet)',
  'Wheat',
  'Cotton',
  'Copra',
  'Groundnut',
  'Mustard',
  'Niger Seed(Ramtil)',
  'Safflower',
  'Sesamum(Sesame,Gingelly,Til)',
  'Soyabean',
  'Sugarcane',
  'Arhar(Tur/Red Gram)(Whole)',
  'Bengal Gram(Gram)(Whole)',
  'Black Gram(Urd Beans)(Whole)',
  'Green Gram(Moong)(Whole)',
  'Lentil(Masur)(Whole)',
  'Onion',
  'Potato',
  'Tomato'
];

async function verifyCropsInDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Cloud');
    
    console.log(`\n🔍 Verifying ${expectedCrops.length} expected crops in database...\n`);
    
    const dbCrops = await CropPrice.distinct('crop');
    
    let foundCount = 0;
    let missingCrops = [];
    
    for (const expectedCrop of expectedCrops) {
      const found = dbCrops.includes(expectedCrop);
      if (found) {
        console.log(`✅ ${expectedCrop}`);
        foundCount++;
      } else {
        console.log(`❌ ${expectedCrop} - MISSING`);
        missingCrops.push(expectedCrop);
      }
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`✅ Found: ${foundCount}/${expectedCrops.length} crops`);
    console.log(`❌ Missing: ${missingCrops.length} crops`);
    
    if (missingCrops.length > 0) {
      console.log(`\n🚨 Missing crops:`);
      missingCrops.forEach(crop => console.log(`   - ${crop}`));
    }
    
    console.log(`\n📋 Total crops in DB: ${dbCrops.length}`);
    console.log(`📋 Total records in DB: ${await CropPrice.countDocuments()}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

verifyCropsInDB();