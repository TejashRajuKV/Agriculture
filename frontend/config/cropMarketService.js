// Relative URLs go through the Vite dev proxy (see vite.config.js) to the backend
export const cropMarketAPI = {
  getHealth: async () => {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  },

  getCrops: async () => {
    const response = await fetch('/api/market/crops');
    if (!response.ok) throw new Error('Failed to fetch crops');
    const json = await response.json();
    return json.data || [];
  },

  getCropData: async (cropName) => {
    try {
      const response = await fetch(`/api/market/crop/${encodeURIComponent(cropName)}`);
      if (!response.ok) throw new Error(`Failed to fetch data for ${cropName}`);
      const json = await response.json();
      return json.data || null;
    } catch (error) {
      console.error(`Error fetching data for ${cropName}:`, error);
      return null;
    }
  }
};
