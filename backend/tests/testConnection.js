import fetch from 'node-fetch';

async function testConnection() {
  try {
    console.log('🔄 Testing backend connection...');
    
    // Test 1: Health check
    const healthResponse = await fetch('http://localhost:5000/api/health');
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Server health:', healthData);
    } else {
      console.log('❌ Server not responding on port 5000');
      return;
    }
    
    // Test 2: Get crops
    const cropsResponse = await fetch('http://localhost:5000/api/market/crops');
    if (cropsResponse.ok) {
      const cropsData = await cropsResponse.json();
      console.log('✅ Crops API:', cropsData);
    } else {
      console.log('❌ Crops API failed');
    }
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    console.log('💡 Make sure to run: node server.js');
  }
}

testConnection();