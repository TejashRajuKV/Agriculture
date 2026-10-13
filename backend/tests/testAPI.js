import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:5000/api';

async function testAPI() {
  try {
    console.log('🔍 Testing Crop Market API endpoints...\n');
    
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await fetch(`${API_BASE_URL}/../health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health check:', healthData.message);
    } else {
      console.log('❌ Health check failed');
    }
    
    // Test 2: Get crops list
    console.log('\n2️⃣ Testing crops list endpoint...');
    const cropsResponse = await fetch(`${API_BASE_URL}/market/crops`);
    if (cropsResponse.ok) {
      const cropsData = await cropsResponse.json();
      console.log(`✅ Crops endpoint: ${cropsData.data?.length || 0} crops found`);
      console.log('First 5 crops:', cropsData.data?.slice(0, 5));
    } else {
      console.log('❌ Crops endpoint failed:', cropsResponse.status);
    }
    
    // Test 3: Get specific crop data
    console.log('\n3️⃣ Testing specific crop endpoint...');
    const cropResponse = await fetch(`${API_BASE_URL}/market/Wheat`);
    if (cropResponse.ok) {
      const cropData = await cropResponse.json();
      console.log('✅ Wheat data:', {
        crop: cropData.data?.crop,
        price: cropData.data?.price,
        trend: cropData.data?.trend,
        pricesCount: cropData.data?.prices?.length
      });
    } else {
      console.log('❌ Wheat endpoint failed:', cropResponse.status);
      const errorText = await cropResponse.text();
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ API Test failed:', error.message);
    console.log('\n💡 Make sure server is running: node server.js');
  }
}

testAPI();