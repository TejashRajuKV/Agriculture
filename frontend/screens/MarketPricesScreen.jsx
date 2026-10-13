import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, Activity, MessageCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { LocalMandis } from '../components/Common/LocalMandis.jsx';
import { cropMarketAPI } from '../config/cropMarketService.js';
import './MarketPricesScreen.css';

export const MarketPricesScreen = ({ user }) => {
  const [crops, setCrops] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    checkServerStatus();
    loadCropData();
  }, []);

  const checkServerStatus = async () => {
    try {
      await cropMarketAPI.getHealth();
      setServerStatus('connected');
    } catch (error) {
      setServerStatus('disconnected');
    }
  };

  const loadCropData = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const availableCrops = await cropMarketAPI.getCrops();
      const results = await Promise.all(availableCrops.map(crop => cropMarketAPI.getCropData(crop)));
      const validCropData = results.filter(Boolean);
      setCrops(validCropData);
      if (validCropData.length === 0) {
        setLoadError('No price data found. Add an AGMARKNET CSV to backend/data or seed MongoDB.');
      }
    } catch (error) {
      console.error('Error loading crop data:', error);
      setLoadError('Cannot reach the backend. Start it with: cd backend && npm run dev');
    } finally {
      setIsLoading(false);
    }
  };

  const asOf = crops.find(c => c.asOf)?.asOf;
  const staleDays = asOf ? Math.floor((Date.now() - new Date(asOf).getTime()) / 86400000) : null;

  const sendWhatsAppPrice = (cropData) => {
    const { crop, price, trend, percentageChange } = cropData;
    const message = `🌾 *AgriLoop Market Update*\n\n📊 *${crop}*\n💰 Price: ₹${price?.toLocaleString()}/quintal\n📈 ${percentageChange > 0 ? "+" : ""}${percentageChange?.toFixed(2)}% vs previous trading day (${asOf || "date unknown"})\n\nSource: AGMARKNET all-India average, via AgriLoop`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="crop-market-screen">
      <div className="market-header">
        <h1 className="market-title">
          <BarChart3 size={32} /> Crop Market Dashboard
        </h1>
        <p className="market-subtitle">
          All-India average mandi prices from AGMARKNET (not live prices)
        </p>
        <div className={`server-status ${serverStatus}`}>
          <span className="status-dot"></span>
          {serverStatus === 'connected' && (asOf
            ? `AGMARKNET prices as of ${new Date(asOf).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : 'Server Connected')}
          {serverStatus === 'disconnected' && 'Server Disconnected - Start with: cd backend && npm run dev'}
          {serverStatus === 'checking' && 'Checking server...'}
        </div>
      </div>

      {staleDays != null && staleDays > 7 && (
        <div className="market-stale" role="note">
          These prices are from {new Date(asOf).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, about {staleDays} days ago. Check your local mandi before you sell. Live district prices need the daily AGMARKNET feed to be connected.
        </div>
      )}

      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading market data...</p>
        </div>
      ) : loadError ? (
        <div className="market-error">
          <p>{loadError}</p>
          <button className="market-retry" onClick={() => { checkServerStatus(); loadCropData(); }}>
            Retry
          </button>
        </div>
      ) : (
        <div className="market-content">
          {/* Stock Market Table View */}
          <div className="stock-table-container">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Commodity</th>
                  <th>Price (₹/Quintal)</th>
                  <th>1-day change</th>
                  <th>% change</th>
                  <th>Trend</th>
                  <th>MSP</th>
                  <th>Arrivals</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {crops.map((cropData, index) => (
                  <StockRow 
                    key={index} 
                    cropData={cropData} 
                    onClick={() => setSelectedCrop(cropData)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {selectedCrop && (
            <div className="crop-details">
              <PriceChart cropData={selectedCrop} />
              <LocalMandis key={selectedCrop.crop} crop={selectedCrop.crop} userLocation={user?.location} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StockRow = ({ cropData, onClick }) => {
  const { crop, price, yesterdayPrice, trend, percentageChange } = cropData;
  const currentPrice = price || cropData.currentPrice;
  const prevPrice = yesterdayPrice || cropData.previousPrice || currentPrice;
  const priceChange = currentPrice - prevPrice;

  const sendWhatsAppPrice = (cropData) => {
    const { crop, price, trend, percentageChange } = cropData;
    const message = `🌾 *AgriLoop Market Update*\n\n📊 *${crop}*\n💰 Price: ₹${price?.toLocaleString()}/quintal\n📈 Trend: ${trend} (${percentageChange > 0 ? '+' : ''}${percentageChange?.toFixed(2)}%)\n\nSource: AGMARKNET all-India average, via AgriLoop`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <tr className={`stock-row ${trend?.toLowerCase()}`} onClick={onClick}>
      <td className="commodity-name">
        <div className="commodity-info">
          <span className="commodity-symbol">{crop}</span>
        </div>
      </td>
      <td className="price-cell">
        <span className="current-price">₹{currentPrice?.toLocaleString()}</span>
      </td>
      <td className={`change-cell ${trend?.toLowerCase()}`}>
        <span className="price-change">
          {priceChange > 0 ? '+' : priceChange < 0 ? '−' : ''}₹{Math.abs(priceChange).toFixed(0)}
        </span>
      </td>
      <td className={`percent-cell ${trend?.toLowerCase()}`}>
        <span className="percent-change">
          {percentageChange > 0 ? '+' : ''}{percentageChange?.toFixed(2)}%
        </span>
      </td>
      <td className="trend-cell">
        <TrendBadge trend={trend} />
      </td>
      <td className="msp-cell">
        {cropData.msp ? (
          <span className={`msp-value ${currentPrice >= cropData.msp ? 'above' : 'below'}`}>
            ₹{Math.round(cropData.msp).toLocaleString()}
          </span>
        ) : (
          <span className="volume">—</span>
        )}
      </td>
      <td className="volume-cell">
        <span className="volume">
          {cropData.arrivalTonnes != null ? `${Math.round(cropData.arrivalTonnes).toLocaleString()} t` : '—'}
        </span>
      </td>
      <td className="action-cell">
        <div className="action-buttons">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              sendWhatsAppPrice(cropData);
            }}
            className="whatsapp-btn"
            title="Send price via WhatsApp"
          >
            <MessageCircle size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
};

const TrendBadge = ({ trend }) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'UP':
        return <TrendingUp size={16} />;
      case 'DOWN':
        return <TrendingDown size={16} />;
      case 'STABLE':
        return <Minus size={16} />;
      default:
        return <Minus size={16} />;
    }
  };

  return (
    <div className={`trend-badge ${trend.toLowerCase()}`}>
      {getTrendIcon()}
      <span>{trend}</span>
    </div>
  );
};

const PriceChart = ({ cropData }) => {
  const { crop, last7Days, prices } = cropData;
  const chartData = last7Days || prices || [];
  
  // Format data for Recharts
  const formattedData = chartData.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    price: day.price,
    fullDate: day.date
  }));
  
  // Determine chart color based on trend
  const getChartColor = () => {
    switch (cropData.trend) {
      case 'UP': return '#10b981'; // Green
      case 'DOWN': return '#ef4444'; // Red
      default: return '#f59e0b'; // Yellow
    }
  };
  
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{label}</p>
          <p className="tooltip-value">
            <span className="tooltip-currency">₹</span>
            {payload[0].value.toLocaleString()}
            <span className="tooltip-unit">/quintal</span>
          </p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="stock-chart">
      <div className="chart-header">
        <h3 className="chart-title">
          <Activity size={20} />
          {crop} - Price Movement
        </h3>
        <div className="chart-stats">
          <span className={`current-price ${cropData.trend?.toLowerCase()}`}>
            ₹{(cropData.price || cropData.currentPrice)?.toLocaleString()}
          </span>
          <span className={`price-change ${cropData.trend?.toLowerCase()}`}>
            {cropData.percentageChange > 0 ? '+' : ''}{cropData.percentageChange?.toFixed(2)}%
          </span>
        </div>
      </div>
      
      <div className="chart-container-stock">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={getChartColor()} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={getChartColor()} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value) => `₹${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={getChartColor()}
              strokeWidth={3}
              fill="url(#colorPrice)"
              dot={{ fill: getChartColor(), strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: getChartColor(), strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="chart-suggestion">
        <div className="suggestion-badge">
          {priceContext(cropData)}
        </div>
        <p className="chart-caveat">Based on only {formattedData.length} day{formattedData.length === 1 ? '' : 's'} of prices. This is not a forecast of where prices will go.</p>
      </div>
    </div>
  );
};

// Plain facts from the data - never "sell now" / "hold" advice, which a few days of prices cannot support
const priceContext = (cropData) => {
  const price = cropData.price || cropData.currentPrice;
  const msp = cropData.msp;
  if (!msp) return 'No government MSP applies to this crop. Compare with your local mandi before selling.';
  const diff = Math.round(price - msp);
  return diff >= 0
    ? `Mandi price is ₹${diff.toLocaleString('en-IN')} above the MSP of ₹${Math.round(msp).toLocaleString('en-IN')}/quintal.`
    : `Mandi price is ₹${Math.abs(diff).toLocaleString('en-IN')} below the MSP of ₹${Math.round(msp).toLocaleString('en-IN')}/quintal. A government procurement centre pays at least MSP for eligible crops.`;
};
