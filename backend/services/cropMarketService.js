// Crop Market API Service - Real AGMARKNET Data
const API_BASE_URL = 'http://localhost:5001/api';

export const cropMarketAPI = {
  // Get list of available crops
  getCrops: async () => {
    try {
      console.log('📡 Fetching crops from:', `${API_BASE_URL}/market/crops`);
      
      // Add timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${API_BASE_URL}/market/crops`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📡 Crops response:', data);
      return data.success ? data.data : [];
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('❌ Request timeout - Server may not be running');
      } else if (error.message.includes('fetch')) {
        console.error('❌ Cannot connect to server. Is it running on port 5000?');
      } else {
        console.error('❌ Error fetching crops:', error.message);
      }
      return [];
    }
  },

  // Get market data for a specific crop (real AGMARKNET data)
  getCropData: async (crop) => {
    try {
      const response = await fetch(`${API_BASE_URL}/market/${encodeURIComponent(crop)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        return data.data; // Return the complete data object
      }
      return null;
    } catch (error) {
      console.error(`Error fetching data for ${crop}:`, error);
      return null;
    }
  },

  // Add new price data (for testing/admin)
  addPriceData: async (priceData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/market/price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(priceData)
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error adding price data:', error);
      return false;
    }
  },

  // Seed sample data (for testing)
  seedData: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/seed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error seeding data:', error);
      return false;
    }
  }
};