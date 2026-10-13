import React, { useEffect, useState } from 'react';
import { Calculator, Ruler, Sprout, Droplets, ClipboardList, MapPin, Info } from 'lucide-react';
import { generateFarmPlan, fetchMandiPrice, PLANNER_CROPS, SQ_M_PER_ACRE } from '../utils/aiWasteAnalyzer.js';
import { inr } from '../utils/format.js';
import { useToast } from '../components/Common/Toast.jsx';
import './FarmingGuideScreen.css';

const CROPS = Object.keys(PLANNER_CROPS);
const STATES = [
  'Punjab', 'Haryana', 'Uttar Pradesh', 'Madhya Pradesh', 'Maharashtra', 'Gujarat', 'Andhra Pradesh', 'Karnataka',
  'Tamil Nadu', 'West Bengal', 'Bihar', 'Rajasthan', 'Telangana', 'Odisha', 'Kerala', 'Assam', 'Chhattisgarh', 'Jharkhand', 'Uttarakhand'
];

// A rough guide: how many plants, a typical yield, and income at the price YOU enter
// (pre-filled with the latest all-India mandi price when we have one).
export const FarmingGuideScreen = () => {
  const toast = useToast();
  const [mode, setMode] = useState('size'); // 'size' (length x breadth) | 'acres'
  const [length, setLength] = useState('');
  const [breadth, setBreadth] = useState('');
  const [acres, setAcres] = useState('');
  const [unit, setUnit] = useState('feet');
  const [crop, setCrop] = useState('Rice (Paddy)');
  const [selectedState, setSelectedState] = useState('Punjab');
  const [price, setPrice] = useState('');
  const [mandi, setMandi] = useState(null); // { price, asOf } | null
  const [mandiLoading, setMandiLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Pre-fill the price from the mandi data whenever the crop changes
  useEffect(() => {
    let cancelled = false;
    setMandiLoading(true);
    setMandi(null);
    setPrice('');
    fetchMandiPrice(crop).then((m) => {
      if (cancelled) return;
      setMandi(m);
      if (m) setPrice(String(Math.round(m.price)));
      setMandiLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [crop]);

  const handlePlan = async () => {
    setError('');
    let l;
    let b;
    let u;
    if (mode === 'acres') {
      const a = Number(acres);
      if (!(a > 0)) return setError('Enter your land area in acres.');
      l = b = Math.sqrt(a * SQ_M_PER_ACRE);
      u = 'meters';
    } else {
      l = Number(length);
      b = Number(breadth);
      u = unit;
      if (!(l > 0) || !(b > 0)) return setError('Enter both the length and the breadth of your land.');
    }
    try {
      setResult({ ...(await generateFarmPlan(l, b, u, crop, selectedState, price)), crop, state: selectedState, priceUsed: Number(price) || null });
    } catch (e) {
      toast.error('Could not make the plan. Please check the numbers and try again.');
    }
  };

  return (
    <div className="farming-guide-container">
      <div className="farming-guide-header">
        <h2 className="farming-guide-title">
          <Calculator size={24} /> Farm Planner
        </h2>
        <p className="farming-guide-subtitle">
          A quick guide to plants, spacing and the income you can expect from your land. It uses typical yields and the price you enter.
        </p>
      </div>

      <div className="farming-guide-form">
        <h3 className="form-section-title">Land details</h3>

        <div className="input-group">
          <label className="input-label">How do you know your land size?</label>
          <div className="unit-selector">
            <button type="button" onClick={() => setMode('size')} className={`unit-button ${mode === 'size' ? 'unit-button-active' : ''}`}>Length × breadth</button>
            <button type="button" onClick={() => setMode('acres')} className={`unit-button ${mode === 'acres' ? 'unit-button-active' : ''}`}>Area in acres</button>
          </div>
        </div>

        {mode === 'size' ? (
          <>
            <div className="land-inputs">
              <div className="input-group">
                <label className="input-label" htmlFor="fp-length">Length</label>
                <input id="fp-length" type="number" min="0" inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} className="form-input" placeholder="0" />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="fp-breadth">Breadth</label>
                <input id="fp-breadth" type="number" min="0" inputMode="decimal" value={breadth} onChange={(e) => setBreadth(e.target.value)} className="form-input" placeholder="0" />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Unit</label>
              <div className="unit-selector">
                <button type="button" onClick={() => setUnit('feet')} className={`unit-button ${unit === 'feet' ? 'unit-button-active' : ''}`}>Feet (ft)</button>
                <button type="button" onClick={() => setUnit('meters')} className={`unit-button ${unit === 'meters' ? 'unit-button-active' : ''}`}>Meters (m)</button>
              </div>
            </div>
          </>
        ) : (
          <div className="input-group">
            <label className="input-label" htmlFor="fp-acres">Land area (acres)</label>
            <input id="fp-acres" type="number" min="0" step="0.25" inputMode="decimal" value={acres} onChange={(e) => setAcres(e.target.value)} className="form-input" placeholder="e.g. 2.5" />
          </div>
        )}

        <h3 className="form-section-title">Crop & price</h3>

        <div className="input-group">
          <label className="input-label">State</label>
          <div className="select-wrapper">
            <MapPin className="select-icon" size={18} />
            <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="form-select form-select-with-icon">
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Crop to plant</label>
          <select value={crop} onChange={(e) => setCrop(e.target.value)} className="form-select">
            {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="fp-price">
            Expected selling price <span className="input-label-note">(₹ per quintal)</span>
          </label>
          <input id="fp-price" type="number" min="0" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className="form-input" placeholder={mandiLoading ? 'Looking up mandi price…' : 'Enter the price you expect'} />
          <p className="planner-price-note">
            <Info size={13} />{' '}
            {mandi
              ? `Pre-filled with the all-India average mandi price${mandi.asOf ? ` (${mandi.asOf})` : ''}. Your local mandi price will differ, so change it to what you expect.`
              : mandiLoading
                ? 'Checking the latest mandi price…'
                : 'No mandi price available for this crop. Enter the price you expect to get.'}
          </p>
        </div>

        {error && <p className="planner-error" role="alert">{error}</p>}
        <button type="button" onClick={handlePlan} className="plan-button">Calculate</button>
      </div>

      {result && (
        <div className="results-container">
          <h3 className="results-title">Your plan for {result.crop}</h3>

          <div className="results-card">
            <div className="revenue-section">
              <p className="revenue-label">Estimated income before costs</p>
              <h2 className="revenue-amount">{result.revenue != null ? inr(result.revenue) : '—'}</h2>
              <p className="revenue-note">
                {result.revenue != null
                  ? `${result.estimatedYieldQ} quintals × ${inr(result.priceUsed)} per quintal. Seed, fertiliser, labour and water are not subtracted.`
                  : result.estimatedYieldQ == null
                    ? 'No typical yield is available for this crop, so no income is estimated.'
                    : 'Enter a selling price above to see the income.'}
              </p>
            </div>

            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-header"><Sprout size={16} /> Plants needed</div>
                <p className="stat-value">{result.plantCount != null ? result.plantCount.toLocaleString('en-IN') : 'Sown in rows'}</p>
                <p className="stat-description">for {result.areaAcres.toFixed(2)} acres</p>
              </div>
              <div className="stat-item">
                <div className="stat-header"><Ruler size={16} /> Spacing</div>
                <p className="stat-description">{result.spacing}</p>
              </div>
            </div>

            <div className="soil-section">
              <div className="soil-header"><Droplets size={16} /> Suitable soil</div>
              <p className="soil-recommendation">{result.bestSoil}</p>
            </div>
          </div>

          <div className="tips-section">
            <h4 className="tips-title"><ClipboardList size={18} /> Good to know</h4>
            <ul className="tips-list">
              {result.tips.map((tip, i) => (
                <li key={i} className="tip-item"><span className="tip-bullet"></span>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
