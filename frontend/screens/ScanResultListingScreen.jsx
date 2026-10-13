import React, { useState } from 'react';
import { Button } from '../components/Common/Button.jsx';
import { Plus, Truck, Droplets, Sparkles, Leaf, Trees, Search } from 'lucide-react';
import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { MOISTURE_LEVELS, RESIDUE_TYPES } from '../utils/visionCatalog.js';
import { formatPriceRange } from '../utils/aiWasteAnalyzer.js';
import './ScanResultListingScreen.css';

// Rough figures used for the comparison chart
const KG_CO2_PER_CAR_KM = 0.17;        // average petrol car
const KG_CO2_TRANSPORT_PER_TONNE = 60;  // ~50 km truck trip to a buyer

export const ScanResultListingScreen = ({ scanResult, onCancel, onConfirm }) => {
  const [moisture, setMoisture] = useState(scanResult?.analysis?.moisture || 'dry');
  const [residueKey, setResidueKey] = useState(scanResult?.analysis?.residueKey || '');
  const [quantity, setQuantity] = useState('5');
  if (!scanResult) return null;
  const { analysis: scanned, image } = scanResult;

  // The farmer can correct the residue type; details then come from the catalog
  const override = residueKey && residueKey !== scanned.residueKey ? RESIDUE_TYPES[residueKey] : null;
  const analysis = override
    ? {
        ...scanned,
        residueKey,
        residueType: override.residueType,
        suggestedUses: override.suggestedUses,
        transportFeasibility: override.transportFeasibility,
        environmentalImpactScore: override.environmentalImpactScore,
        pricePerTonMin: override.pricePerTonMin,
        pricePerTonMax: override.pricePerTonMax,
        notes: override.notes || '',
        correctedByFarmer: true
      }
    : scanned;

  const co2Saved = analysis.co2Saved || 0;
  const treeEquivalents = Math.round(co2Saved / 21); // Approx 21kg CO2 per tree per year
  const carKm = Math.round(co2Saved / KG_CO2_PER_CAR_KM / 100) * 100;
  const confidencePct = Math.round((Number(scanned.confidence) || 0) * 100);
  const notWaste = scanned.isAgriculturalWaste === false;
  const unsure = !notWaste && !override && confidencePct < 50;

  // Wet residue sells for less; recompute the price from the base range
  const moistureLevel = MOISTURE_LEVELS.find((m) => m.key === moisture) || MOISTURE_LEVELS[0];
  const hasPriceRange = analysis.pricePerTonMin != null && analysis.pricePerTonMax != null;
  const priceRange = hasPriceRange
    ? formatPriceRange(analysis.pricePerTonMin * moistureLevel.priceFactor, analysis.pricePerTonMax * moistureLevel.priceFactor)
    : analysis.estimatedPriceRange;

  const impactData = [
    { name: 'If burned', value: co2Saved, color: '#ef4444' },
    { name: 'If sold', value: KG_CO2_TRANSPORT_PER_TONNE, color: '#16a34a' }
  ];

  const quantityNum = Number(quantity);
  const quantityValid = Number.isFinite(quantityNum) && quantityNum > 0 && quantityNum <= 10000;

  const handleConfirm = () => {
    if (!quantityValid) return;
    onConfirm({
      analysis: {
        ...analysis,
        moisture,
        moistureContent: `${moistureLevel.label} (${moistureLevel.detail})`,
        pricePerTonMin: hasPriceRange ? Math.round(analysis.pricePerTonMin * moistureLevel.priceFactor) : analysis.pricePerTonMin,
        pricePerTonMax: hasPriceRange ? Math.round(analysis.pricePerTonMax * moistureLevel.priceFactor) : analysis.pricePerTonMax,
        estimatedPriceRange: priceRange
      },
      quantity: Math.round(quantityNum * 10) / 10
    });
  };

  return (
    <div className="scan-result-container">
      <div className="scan-result-header">
          <img src={image} className="header-image" alt="Scanned" />
          <div className="header-overlay">
              <div className="ai-badge">
                  <Sparkles size={12} /> On-device AI
              </div>
              <h2 className="header-title">{notWaste ? 'Not crop residue' : analysis.residueType}</h2>
              <div className="header-badges">
                  <span className="confidence-badge">
                    {override ? 'Set by you' : `Confidence ${confidencePct}%`}
                  </span>
              </div>
          </div>
          <button onClick={onCancel} className="close-button">
              <Plus className="close-icon" />
          </button>
      </div>

      <div className="scan-result-content">
          {notWaste && (
              <div className="scan-note scan-note-warning">
                  This photo doesn't look like crop residue. Try a closer, well-lit photo of the straw or stalks.
              </div>
          )}
          {analysis.notes && <div className="scan-note">{analysis.notes}</div>}

          {!notWaste && (
              <div className={`residue-picker ${unsure ? 'residue-picker-unsure' : ''}`}>
                  <label htmlFor="residue-type">
                      {unsure ? "Not sure about this one – please check the residue type:" : 'Residue type (change it if wrong):'}
                  </label>
                  <select
                      id="residue-type"
                      value={analysis.residueKey}
                      onChange={(e) => setResidueKey(e.target.value)}
                  >
                      {Object.entries(RESIDUE_TYPES).map(([key, t]) => (
                          <option key={key} value={key}>{t.residueType}</option>
                      ))}
                  </select>
              </div>
          )}

          {/* 1. Moisture (farmer picks) & second-best match */}
          <div className="metrics-grid">
              <div className="metric-card metric-card-blue">
                  <div className="metric-icon metric-icon-blue">
                      <Droplets size={20} />
                  </div>
                  <p className="metric-label">How dry is it?</p>
                  <div className="moisture-options" role="radiogroup" aria-label="Moisture">
                      {MOISTURE_LEVELS.map((m) => (
                          <button
                              key={m.key}
                              type="button"
                              role="radio"
                              aria-checked={moisture === m.key}
                              className={`moisture-option ${moisture === m.key ? 'active' : ''}`}
                              onClick={() => setMoisture(m.key)}
                          >
                              {m.label}
                          </button>
                      ))}
                  </div>
                  <p className="metric-hint">Moisture {moistureLevel.detail}. Drier residue gets a better price.</p>
              </div>
              <div className="metric-card metric-card-amber">
                   <div className="metric-icon metric-icon-amber">
                      <Search size={20} />
                  </div>
                  <p className="metric-label">Next best match</p>
                  <p className="metric-value metric-value-sm">
                      {analysis.alternative
                        ? `${analysis.alternative.residueType} (${Math.round(analysis.alternative.confidence * 100)}%)`
                        : '—'}
                  </p>
                  <p className="metric-hint">If this looks more like it, pick it in the residue type list above.</p>
              </div>
          </div>

          {/* 2. Price & Impact Main Cards */}
          <div className="price-impact-grid">
              <div className="price-card">
                  <p className="price-label">Typical price range</p>
                  <p className="price-value">{priceRange}<span className="price-unit">/ton</span></p>
                  <p className="metric-hint">Typical buyer range for {analysis.residueType?.toLowerCase()}.</p>
              </div>
              <div className="impact-card">
                  <p className="impact-label">Environmental benefit (typical, out of 10)</p>
                  <div className="impact-score">
                      <p className="impact-value">{analysis.environmentalImpactScore}</p>
                      <span className="impact-max">/10</span>
                  </div>
              </div>
          </div>

          {/* 3. Carbon impact */}
          <div className="carbon-visualizer">
              <div className="visualizer-header">
                  <h3 className="visualizer-title">
                      <Leaf size={18} /> Carbon Impact Visualizer
                  </h3>
                  <span className="live-calc-badge">Per tonne</span>
              </div>

              <div className="visualizer-content">
                  <div className="carbon-stats">
                      <div className="co2-stat">
                         <p className="co2-value">{co2Saved.toLocaleString('en-IN')} kg</p>
                         <p className="co2-label">CO₂ kept out of the air per tonne sold instead of burned</p>
                      </div>
                      <div className="tree-stat">
                         <p className="tree-value">
                             <Trees size={28} /> {treeEquivalents}
                         </p>
                         <p className="tree-label">Trees needed to absorb that in a year</p>
                      </div>
                  </div>

                  <div className="chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={impactData} barSize={20}>
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} />
                              <Tooltip cursor={{fill: 'transparent'}} formatter={(v) => [`${v.toLocaleString('en-IN')} kg CO₂`, '']} />
                              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                  {impactData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
                  <p className="chart-note">
                      Burning one tonne releases about as much CO₂ as driving a car {carKm.toLocaleString('en-IN')} km.
                      Selling it only costs the truck trip to the buyer.
                  </p>
              </div>
          </div>

          {/* Suggested Uses */}
          <div className="uses-section">
              <h3 className="uses-title">Best Monetizable Uses</h3>
              <div className="uses-tags">
                  {analysis.suggestedUses.map((use, i) => (
                      <span key={i} className="use-tag">{use}</span>
                  ))}
              </div>
          </div>

          <div className="transport-section">
              <h3 className="transport-title">Transport Feasibility</h3>
              <div className="transport-content">
                  <div className={`transport-icon ${analysis.transportFeasibility === 'High' ? 'transport-icon-green' : 'transport-icon-orange'}`}>
                      <Truck size={24} />
                  </div>
                  <div className="transport-info">
                      <p className="transport-feasibility">{analysis.transportFeasibility} Feasibility</p>
                      <p className="transport-description">
                          {analysis.transportFeasibility === 'High'
                            ? 'Dense and easy to load – cheap to move to a buyer.'
                            : 'Bulky – bale it first to cut transport cost.'}
                      </p>
                  </div>
              </div>
          </div>

          {!notWaste && (
              <div className="quantity-picker">
                  <label htmlFor="listing-quantity">How much do you have?</label>
                  <div className="quantity-input">
                      <input
                          id="listing-quantity"
                          type="number"
                          min="0"
                          step="0.5"
                          inputMode="decimal"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                      />
                      <span>tonnes</span>
                  </div>
                  {quantityValid && hasPriceRange && (
                      <p className="metric-hint">
                          Expected earnings: {formatPriceRange(
                            analysis.pricePerTonMin * moistureLevel.priceFactor * quantityNum,
                            analysis.pricePerTonMax * moistureLevel.priceFactor * quantityNum
                          )} · rough guide: 1 acre of paddy leaves about 2.5 t of straw
                      </p>
                  )}
                  {!quantityValid && <p className="metric-hint quantity-error">Enter a quantity greater than 0.</p>}
              </div>
          )}

          {notWaste ? (
              <Button onClick={onCancel} className="list-button">Scan another photo</Button>
          ) : (
              <Button onClick={handleConfirm} className="list-button" disabled={!quantityValid}>List on Marketplace</Button>
          )}
      </div>
    </div>
  );
};
