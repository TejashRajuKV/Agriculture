// Simple test to check if server is responding
const testServer = async () => {
  try {
    console.log('🔍 Testing server endpoints...\n');
    
    // Test using built-in fetch (Node 18+)
    const response = await fetch('http://localhost:5000/api/health');
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Server is running:', data.message);
      
      // Test crops endpoint
      const cropsResponse = await fetch('http://localhost:5000/api/market/crops');
      if (cropsResponse.ok) {
        const cropsData = await cropsResponse.json();
        console.log(`✅ Crops API working: ${cropsData.data?.length} crops`);
      } else {
        console.log('❌ Crops API failed:', cropsResponse.status);
      }
    } else {
      console.log('❌ Server not responding:', response.status);
    }
    
  } catch (error) {
    console.log('❌ Server not running or not accessible');
    console.log('💡 Start server with: node server.js');
    console.log('💡 Then test frontend at: http://localhost:5173');
  }
};

testServer();