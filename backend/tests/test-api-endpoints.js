import fetch from 'node-fetch';

const testAPI = async () => {
  console.log('🧪 Testing API endpoints...\n');

  // Test server health
  try {
    console.log('1️⃣ Testing server health...');
    const healthResponse = await fetch('http://localhost:5000/api/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
  } catch (error) {
    console.log('❌ Server not running on port 5000');
    console.log('💡 Start server with: npm run server');
    return;
  }

  // Test crops endpoint
  try {
    console.log('\n2️⃣ Testing crops endpoint...');
    const cropsResponse = await fetch('http://localhost:5000/api/market/crops');
    const cropsData = await cropsResponse.json();
    console.log('✅ Crops endpoint:', cropsData);
  } catch (error) {
    console.log('❌ Crops endpoint failed:', error.message);
  }

  // Test specific crop data
  try {
    console.log('\n3️⃣ Testing wheat data...');
    const wheatResponse = await fetch('http://localhost:5000/api/market/Wheat');
    const wheatData = await wheatResponse.json();
    console.log('✅ Wheat data:', wheatData);
  } catch (error) {
    console.log('❌ Wheat data failed:', error.message);
  }
};

testAPI();