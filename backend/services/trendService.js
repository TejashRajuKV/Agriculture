// Trend Calculation Service (Core Intelligence)
// This mimics stock market trend calculation

export const calculateTrend = (todayPrice, yesterdayPrice) => {
  if (!todayPrice || !yesterdayPrice) return 'STABLE';
  
  const percentageChange = ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100;
  
  // Stock-like trend rules
  if (percentageChange > 2) return 'UP';
  if (percentageChange < -2) return 'DOWN';
  return 'STABLE';
};

export const calculatePercentageChange = (todayPrice, yesterdayPrice) => {
  if (!todayPrice || !yesterdayPrice) return 0;
  
  return ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100;
};

export const getSuggestion = (trend) => {
  switch (trend) {
    case 'UP':
      return 'Hold for few days';
    case 'DOWN':
      return 'Sell now';
    case 'STABLE':
      return 'Monitor market';
    default:
      return 'Monitor market';
  }
};

export const formatPriceChange = (percentageChange) => {
  const sign = percentageChange > 0 ? '+' : '';
  return `${sign}${percentageChange.toFixed(2)}%`;
};

// Get last N days data for trend analysis
export const analyzeCropTrend = (priceHistory) => {
  if (!priceHistory || priceHistory.length < 2) {
    return {
      trend: 'STABLE',
      percentageChange: 0,
      suggestion: 'Monitor market'
    };
  }
  
  // Sort by date (latest first)
  const sortedPrices = priceHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const todayPrice = sortedPrices[0].price;
  const yesterdayPrice = sortedPrices[1].price;
  
  const trend = calculateTrend(todayPrice, yesterdayPrice);
  const percentageChange = calculatePercentageChange(todayPrice, yesterdayPrice);
  const suggestion = getSuggestion(trend);
  
  return {
    trend,
    percentageChange,
    suggestion,
    currentPrice: todayPrice,
    previousPrice: yesterdayPrice
  };
};