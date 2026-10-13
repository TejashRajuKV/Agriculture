# Crop Market Feature - Implementation Guide

## Overview
A complete crop market dashboard similar to stock market, showing real-time mandi prices, trends, and AI-powered suggestions for farmers.

## Tech Stack
- **Frontend**: React (Vite), JavaScript, CSS
- **Backend**: Node.js + Express
- **Database**: MongoDB Cloud
- **Charts**: CSS-based simple charts (can be upgraded to Chart.js/Recharts)

## Features Implemented

### 1. Backend API (server.js)
- **MongoDB Model**: CropPrice schema with crop, mandi, price, date fields
- **REST APIs**:
  - `GET /api/market/crops` - List available crops
  - `GET /api/market/:crop` - Get crop market data with trends
  - `POST /api/market/price` - Add new price data
  - `POST /api/market/seed` - Insert sample data

### 2. Frontend Components
- **CropMarketScreen**: Main dashboard
- **CropCard**: Individual crop price cards
- **TrendBadge**: UP/DOWN/STABLE indicators
- **PriceChart**: 7-day price visualization

### 3. Trend Calculation Logic
```javascript
// Price change > +2% → UP trend (Green 📈)
// Price change < -2% → DOWN trend (Red 📉)  
// Else → STABLE trend (Yellow ➖)
```

### 4. AI Suggestions (Rule-based)
- **UP trend**: "Hold for few days"
- **DOWN trend**: "Sell now"
- **STABLE**: "Monitor market"

## Setup Instructions

### Backend Setup
1. Install dependencies:
```bash
npm install express mongoose cors dotenv
```

2. Create `.env` file:
```env
MONGODB_URI=your_mongodb_cloud_connection_string
PORT=5000
```

3. Start server:
```bash
node server.js
```

4. Seed sample data:
```bash
curl -X POST http://localhost:5000/api/market/seed
```

### Frontend Integration
The CropMarketScreen is already integrated into the main App.jsx navigation for farmers.

## Sample API Responses

### GET /api/market/crops
```json
{
  "success": true,
  "data": ["Wheat", "Rice", "Maize"]
}
```

### GET /api/market/Wheat
```json
{
  "success": true,
  "data": {
    "crop": "Wheat",
    "currentPrice": 2150,
    "yesterdayPrice": 2100,
    "percentageChange": 2.38,
    "trend": "UP",
    "last7Days": [
      {"date": "2024-01-15", "price": 2000},
      {"date": "2024-01-21", "price": 2150}
    ]
  }
}
```

## Data Flow
```
Government Mandi Data → MongoDB Cloud → Express API → React Frontend → Farmer Dashboard
```

## MongoDB Cloud Setup
1. Create account at mongodb.com
2. Create new cluster
3. Get connection string
4. Add to `.env` file as `MONGODB_URI`

## UI Features
- **Farmer-friendly design**: Large text, simple colors
- **Trend indicators**: Green (UP), Red (DOWN), Yellow (STABLE)
- **Price display**: ₹/quintal format
- **7-day charts**: Simple CSS-based visualization
- **Responsive**: Works on mobile devices

## Future Enhancements
- Real government mandi API integration
- Advanced Chart.js/Recharts implementation
- Push notifications for price alerts
- Historical data analysis
- Multiple mandi price comparison

## File Structure
```
AGRILOOP-1/
├── server.js                     # Backend Express server
├── package-backend.json           # Backend dependencies
├── screens/CropMarketScreen.jsx   # Main market dashboard
├── screens/CropMarketScreen.css   # Market dashboard styles
├── services/cropMarketService.js  # API service layer
└── README-CROP-MARKET.md         # This documentation
```

The feature is now fully integrated and ready for testing!