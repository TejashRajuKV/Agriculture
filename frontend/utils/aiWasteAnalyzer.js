import { classifyImage } from './localVision.js';
import {
  RESIDUE_TYPES,
  NOT_RESIDUE_PROMPTS,
  FARM_INPUT_TYPES,
  CO2_KG_PER_TONNE_BURNED
} from './visionCatalog.js';

// Typical well-managed yields in quintals per hectare (1 quintal = 100 kg) and the matching AGMARKNET
// commodity for a price lookup. These are rough national guides, not a forecast for any one field.
// priceUnit says what the market price is quoted per: 'quintal' (grain) - all supported crops use it.
export const PLANNER_CROPS = {
  'Rice (Paddy)': { spacing: '20 × 15 cm', plantsPerHa: 333000, soil: 'Loamy soil with good drainage', yieldQPerHa: 50, mandi: 'Paddy(Common)' },
  'Wheat': { spacing: '22.5 cm between rows', plantsPerHa: null, soil: 'Well-drained loamy soil', yieldQPerHa: 45, mandi: 'Wheat' },
  'Sugarcane': { spacing: '90 × 60 cm', plantsPerHa: 18500, soil: 'Deep fertile soil', yieldQPerHa: 700, mandi: 'Sugarcane' },
  'Cotton': { spacing: '90 × 60 cm', plantsPerHa: 18500, soil: 'Well-drained black soil', yieldQPerHa: 20, mandi: 'Cotton' },
  'Maize (Corn)': { spacing: '60 × 20 cm', plantsPerHa: 83000, soil: 'Fertile loamy soil', yieldQPerHa: 55, mandi: 'Maize' },
  'Tomato': { spacing: '60 × 45 cm', plantsPerHa: 37000, soil: 'Well-drained fertile soil', yieldQPerHa: 250, mandi: 'Tomato' },
  'Potato': { spacing: '60 × 20 cm', plantsPerHa: 83000, soil: 'Loose fertile soil', yieldQPerHa: 230, mandi: 'Potato' },
  'Mustard': { spacing: '30 cm between rows', plantsPerHa: null, soil: 'Well-drained soil', yieldQPerHa: 14, mandi: 'Mustard' },
  'Soybean': { spacing: '45 × 20 cm', plantsPerHa: 111000, soil: 'Well-drained soil', yieldQPerHa: 12, mandi: 'Soyabean' },
  'Onion': { spacing: '15 × 10 cm', plantsPerHa: 666000, soil: 'Well-drained fertile soil', yieldQPerHa: 170, mandi: 'Onion' },
  'Turmeric': { spacing: '25 × 20 cm', plantsPerHa: 200000, soil: 'Well-drained soil', yieldQPerHa: null, mandi: null }
};

export const SQ_M_PER_ACRE = 4046.86;

// price: ₹ per quintal, entered or fetched by the caller. Without a price no revenue is invented.
export const generateFarmPlan = async (length, breadth, unit, crop, state, pricePerQuintal = null) => {
  const lengthM = unit === 'feet' ? length * 0.3048 : length;
  const breadthM = unit === 'feet' ? breadth * 0.3048 : breadth;
  const areaM2 = lengthM * breadthM;
  const areaHectares = areaM2 / 10000;
  const areaAcres = areaM2 / SQ_M_PER_ACRE;

  const data = PLANNER_CROPS[crop] || PLANNER_CROPS['Rice (Paddy)'];
  const plantCount = data.plantsPerHa ? Math.round(data.plantsPerHa * areaHectares) : null;
  const estimatedYieldQ = data.yieldQPerHa ? Math.round(data.yieldQPerHa * areaHectares * 10) / 10 : null;
  const price = Number(pricePerQuintal);
  const revenue = estimatedYieldQ != null && price > 0 ? Math.round(estimatedYieldQ * price) : null;

  const tips = [
    `Use ${data.soil.toLowerCase()} for ${crop}.`,
    `Keep spacing of ${data.spacing}.`,
    estimatedYieldQ != null
      ? `A typical yield is about ${estimatedYieldQ} quintals from ${areaAcres.toFixed(2)} acres. Your own yield will differ with variety, soil, water and weather.`
      : `Yield for ${crop} varies a lot by variety and curing, so no estimate is shown.`,
    `Ask your Krishi Vigyan Kendra (KVK) which variety and sowing dates suit ${state}.`,
    `Rotate crops to keep the soil healthy, and keep crop residue in the field or sell it instead of burning it.`
  ];

  return {
    plantCount,
    areaAcres,
    areaHectares,
    spacing: data.spacing,
    bestSoil: data.soil,
    estimatedYieldQ,
    revenue,
    mandiName: data.mandi,
    tips
  };
};

// Latest all-India mandi price (₹/quintal) from our market endpoint, or null when unavailable
export const fetchMandiPrice = async (crop) => {
  const name = PLANNER_CROPS[crop]?.mandi;
  if (!name) return null;
  try {
    const res = await fetch(`/api/market/crop/${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const { data } = await res.json();
    return data?.price ? { price: data.price, asOf: data.asOf || null } : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Image analysis: on-device CLIP model (no API key, works offline once cached)
// ---------------------------------------------------------------------------

export { CO2_KG_PER_TONNE_BURNED };

const formatPriceRange = (min, max) =>
  `₹${Math.round(min).toLocaleString('en-IN')} - ₹${Math.round(max).toLocaleString('en-IN')}`;

export const analyzeCropWaste = async (imageDataUrl) => {
  const groups = { not_residue: NOT_RESIDUE_PROMPTS };
  Object.entries(RESIDUE_TYPES).forEach(([key, t]) => { groups[key] = t.prompts; });

  const ranked = await classifyImage(imageDataUrl, groups);
  const residues = ranked.filter((r) => r.key !== 'not_residue');
  const notResidue = ranked.find((r) => r.key === 'not_residue')?.score || 0;
  const residueTotal = residues.reduce((s, r) => s + r.score, 0);
  const best = residues[0];
  const info = RESIDUE_TYPES[best.key];

  // Confidence = how sure it is of this residue type among residue types
  const confidence = residueTotal ? best.score / residueTotal : 0;
  const alternative = residues[1] && residueTotal
    ? { residueType: RESIDUE_TYPES[residues[1].key].residueType, confidence: residues[1].score / residueTotal }
    : null;

  return {
    isAgriculturalWaste: notResidue < residueTotal,
    residueType: info.residueType,
    residueKey: best.key,
    suggestedUses: info.suggestedUses,
    transportFeasibility: info.transportFeasibility,
    environmentalImpactScore: info.environmentalImpactScore,
    pricePerTonMin: info.pricePerTonMin,
    pricePerTonMax: info.pricePerTonMax,
    estimatedPriceRange: formatPriceRange(info.pricePerTonMin, info.pricePerTonMax),
    confidence,
    alternative,
    moisture: 'dry',
    co2Saved: CO2_KG_PER_TONNE_BURNED,
    notes: info.notes || '',
    source: 'on-device'
  };
};

export const analyzeFarmInput = async (imageDataUrl) => {
  const groups = {};
  Object.entries(FARM_INPUT_TYPES).forEach(([key, t]) => { groups[key] = t.prompts; });

  const ranked = await classifyImage(imageDataUrl, groups);
  const best = ranked[0];
  const info = FARM_INPUT_TYPES[best.key];

  return {
    type: info.type,
    name: info.name,
    healthScore: info.healthScore,
    summary: info.summary,
    tips: info.tips,
    confidence: best.score,
    source: 'on-device'
  };
};

export { formatPriceRange };
// ---------------------------------------------------------------------------
// Weather: live forecast from Open-Meteo (free, no API key) + farm rules
// ---------------------------------------------------------------------------

const WMO_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Rain showers', 81: 'Heavy rain showers', 82: 'Violent rain showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm with hail'
};

const weatherCache = new Map();
const CACHE_MS = 10 * 60 * 1000;

const normalise = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

const geocode = async (location, state) => {
  // District names are often not towns, so fall back to the state name
  const queries = [location.replace(/\(.*?\)/g, '').trim(), state];
  for (const q of queries) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en&format=json&countryCode=IN`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const { results = [] } = await res.json();
    if (!results.length) continue;
    const inState = results.find((r) => normalise(r.admin1) === normalise(state));
    const hit = inState || results[0];
    return { lat: hit.latitude, lon: hit.longitude, place: [hit.name, hit.admin1].filter(Boolean).join(', ') };
  }
  throw new Error(`Could not find ${location}, ${state}`);
};

const fetchForecast = async (location, state) => {
  const key = `${location}|${state}`;
  const hit = weatherCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const geo = await geocode(location, state);
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${geo.lat}&longitude=${geo.lon}` +
    '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max' +
    '&past_days=3&forecast_days=7&timezone=Asia%2FKolkata';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather service error (${res.status})`);
  const raw = await res.json();

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const days = raw.daily.time.map((date, i) => ({
    date,
    code: raw.daily.weather_code[i],
    tMax: raw.daily.temperature_2m_max[i],
    tMin: raw.daily.temperature_2m_min[i],
    rain: raw.daily.precipitation_sum[i] ?? 0,
    rainProb: raw.daily.precipitation_probability_max[i] ?? 0,
    windMax: raw.daily.wind_speed_10m_max[i] ?? 0
  }));

  const data = {
    place: geo.place,
    current: raw.current,
    past: days.filter((d) => d.date < today),
    forecast: days.filter((d) => d.date >= today)
  };
  weatherCache.set(key, { at: Date.now(), data });
  return data;
};

const fmtDay = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

const SEVERITY_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

const buildAlerts = (forecast) => {
  const alerts = [];
  const rainiest = forecast.reduce((a, b) => (b.rain > a.rain ? b : a), forecast[0]);
  if (rainiest.rain >= 5) {
    const severity = rainiest.rain >= 50 ? 'CRITICAL' : rainiest.rain >= 20 ? 'HIGH' : 'MEDIUM';
    alerts.push({
      type: 'RAIN',
      severity,
      message: `${rainiest.rain.toFixed(0)} mm of rain expected on ${fmtDay(rainiest.date)}`,
      impact: 'Wet straw loses value and cannot be baled; cut crop left in the field is at risk.',
      recommendations: ['Bale and cover residue before the rain', 'Clear field drainage channels', 'Postpone spraying until after the rain'],
      date: fmtDay(rainiest.date)
    });
  }

  const hottest = forecast.reduce((a, b) => (b.tMax > a.tMax ? b : a), forecast[0]);
  if (hottest.tMax >= 40) {
    alerts.push({
      type: 'HEAT_WAVE',
      severity: hottest.tMax >= 44 ? 'CRITICAL' : 'HIGH',
      message: `Heat up to ${hottest.tMax.toFixed(0)}°C on ${fmtDay(hottest.date)}`,
      impact: 'Heat stress on crops and livestock; stored dry residue is a fire risk.',
      recommendations: ['Irrigate in early morning or evening', 'Keep straw stacks away from power lines and fire sources', 'Provide shade and water for animals'],
      date: fmtDay(hottest.date)
    });
  }

  const coldest = forecast.reduce((a, b) => (b.tMin < a.tMin ? b : a), forecast[0]);
  if (coldest.tMin <= 4) {
    alerts.push({
      type: 'FROST',
      severity: coldest.tMin <= 2 ? 'HIGH' : 'MEDIUM',
      message: `Night temperature down to ${coldest.tMin.toFixed(0)}°C on ${fmtDay(coldest.date)}`,
      impact: 'Frost can damage vegetables, mustard and young wheat.',
      recommendations: ['Give a light irrigation in the evening', 'Cover nursery beds', 'Avoid fertiliser application before frost'],
      date: fmtDay(coldest.date)
    });
  }

  const windiest = forecast.reduce((a, b) => (b.windMax > a.windMax ? b : a), forecast[0]);
  if (windiest.windMax >= 40) {
    alerts.push({
      type: 'STORM',
      severity: windiest.windMax >= 60 ? 'HIGH' : 'MEDIUM',
      message: `Strong winds up to ${windiest.windMax.toFixed(0)} km/h on ${fmtDay(windiest.date)}`,
      impact: 'Loose residue can blow away; tall crops may lodge.',
      recommendations: ['Tie down or cover straw bales', 'Delay spraying', 'Secure polyhouse sheets'],
      date: fmtDay(windiest.date)
    });
  }

  const weekRain = forecast.reduce((s, d) => s + d.rain, 0);
  if (weekRain < 2 && hottest.tMax >= 33) {
    alerts.push({
      type: 'DROUGHT',
      severity: 'MEDIUM',
      message: 'No meaningful rain in the next 7 days',
      impact: 'Soil moisture will drop; irrigation needed for standing crops.',
      recommendations: ['Plan irrigation turns now', 'Mulch with crop residue instead of burning it to keep moisture'],
      date: `${fmtDay(forecast[0].date)} – ${fmtDay(forecast[forecast.length - 1].date)}`
    });
  }

  if (!alerts.length) {
    alerts.push({
      type: 'CLEAR',
      severity: 'LOW',
      message: 'No severe weather expected in the next 7 days',
      impact: 'Good conditions for field work.',
      recommendations: ['Good week for harvesting and baling residue'],
      date: `${fmtDay(forecast[0].date)} – ${fmtDay(forecast[forecast.length - 1].date)}`
    });
  }

  return alerts.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
};

// First run of 2+ dry days: when residue can be baled and sold instead of burned
const findDryWindow = (forecast) => {
  let start = -1;
  for (let i = 0; i < forecast.length; i++) {
    const dry = forecast[i].rain < 1 && forecast[i].rainProb < 40;
    if (dry && start === -1) start = i;
    if ((!dry || i === forecast.length - 1) && start !== -1) {
      const end = dry ? i : i - 1;
      if (end - start + 1 >= 2) return { from: forecast[start].date, to: forecast[end].date };
      start = -1;
    }
  }
  return null;
};

export const getWeatherAnalysis = async (location, state, crop) => {
  const { place, current, past, forecast } = await fetchForecast(location, state);

  const alerts = buildAlerts(forecast);
  const pastRain = past.reduce((s, d) => s + d.rain, 0);
  const nextRain = forecast.reduce((s, d) => s + d.rain, 0);
  const maxProb = Math.max(...forecast.map((d) => d.rainProb));
  const topSeverity = alerts[0].severity;

  const soilMoistureStatus =
    pastRain + nextRain > 40 ? 'Wet – risk of waterlogging' : pastRain > 10 ? 'Adequate' : 'Dry – irrigation likely needed';
  const irrigationAdvice =
    nextRain >= 20
      ? 'Skip irrigation this week; expected rain will cover crop water needs.'
      : nextRain >= 5
      ? 'Reduce irrigation and check soil moisture after the expected rain.'
      : 'Irrigate as per crop schedule; little rain is expected.';

  const dryWindow = findDryWindow(forecast);
  const generalRecommendations = [
    dryWindow
      ? `Best window to bale and sell crop residue: ${fmtDay(dryWindow.from)} – ${fmtDay(dryWindow.to)}. List it on AgriLoop instead of burning.`
      : 'No 2-day dry spell this week – store baled residue under cover until conditions improve.',
    `Highest chance of rain this week: ${maxProb}%.`,
    crop ? `Check the ${crop} sowing and harvest advice for timing.` : 'Select a crop for sowing and harvest advice.'
  ];

  return {
    location,
    state,
    place,
    source: 'open-meteo',
    currentWeather: `${WMO_CODES[current.weather_code] || 'Current conditions'}, ${Math.round(current.temperature_2m)}°C, humidity ${current.relative_humidity_2m}%, wind ${Math.round(current.wind_speed_10m)} km/h`,
    alerts,
    rainfallAdvisory: {
      currentRainfall: `${pastRain.toFixed(1)} mm (last 3 days)`,
      forecastRainfall: `${nextRain.toFixed(1)} mm (next 7 days)`,
      soilMoistureStatus,
      irrigationAdvice,
      cropProtectionTips: alerts.flatMap((a) => a.recommendations).slice(0, 4),
      riskLevel: topSeverity
    },
    forecast: forecast.map((d) => ({ ...d, label: fmtDay(d.date), condition: WMO_CODES[d.code] || '' })),
    generalRecommendations
  };
};

export const getSowingHarvestingAdvice = async (crop, location, state) => {
  const cropSeasons = {
    'Rice (Paddy)': { sowing: 'June-July', harvest: 'October-November' },
    'Wheat': { sowing: 'October-November', harvest: 'March-April' },
    'Maize (Corn)': { sowing: 'May-June', harvest: 'September-October' },
    'Cotton': { sowing: 'April-May', harvest: 'October-November' },
    'Sugarcane': { sowing: 'September-October', harvest: 'January-March' }
  };

  const season = cropSeasons[crop];
  // No calendar for this crop: say so instead of showing another crop's dates
  if (!season) {
    return {
      crop,
      noCalendar: true,
      reason: `We do not have a reliable sowing calendar for ${crop} yet. Sowing time depends on your region and variety, so ask your local agriculture office or KVK.`,
      weatherConsiderations: ['Ensure soil moisture before sowing', 'Avoid sowing during extreme heat', 'Check the 7-day rain forecast above']
    };
  }

  return {
    crop,
    optimalSowingDate: season.sowing,
    expectedHarvestDate: season.harvest,
    reason: `Typical all-India season for ${crop}. It varies by region and variety in ${state}, so confirm the exact dates with your local agriculture office.`,
    alternativeSowingDates: ['15 days earlier', '15 days later'],
    weatherConsiderations: [
      'Ensure soil moisture before sowing',
      'Avoid sowing during extreme heat',
      'Monitor rainfall patterns',
      'Check soil temperature'
    ]
  };
};

// Plain-text summary used for the on-screen card and the WhatsApp message
export const getCropWeatherSummary = async (location, state, crop) => {
  const w = await getWeatherAnalysis(location, state, crop);
  const next3 = w.forecast
    .slice(0, 3)
    .map((d) => `- ${d.label}: ${d.condition}, ${Math.round(d.tMin)}–${Math.round(d.tMax)}°C, rain ${d.rain.toFixed(0)} mm`)
    .join('\n');
  const topAlert = w.alerts[0];

  return `Weather for ${crop} in ${w.place}:

Now: ${w.currentWeather}

Next 3 days:
${next3}

Alert: ${topAlert.message} (${topAlert.severity})

Advice:
- ${w.rainfallAdvisory.irrigationAdvice}
- ${w.generalRecommendations[0]}`;
};

export const getAvailableCrops = () => {
  return [
    'Rice (Paddy)', 'Wheat', 'Sugarcane', 'Cotton', 'Maize (Corn)',
    'Tomato', 'Potato', 'Mustard', 'Soybean', 'Onion', 'Turmeric'
  ];
};
