import React, { useMemo, useState } from 'react';
import { Flame, IndianRupee, Leaf, AlertTriangle, Truck, Scale, Wind } from 'lucide-react';
import { RESIDUE_TYPES, CO2_KG_PER_TONNE_BURNED } from '../utils/visionCatalog.js';
import './BurnVsSellScreen.css';

// Typical residue left per acre (tonnes). Farmers can edit it.
const RESIDUE_PER_ACRE = {
  paddy_straw: 2.5,
  wheat_straw: 1.8,
  sugarcane_trash: 3,
  cotton_stalks: 1.5,
  maize_stalks: 2,
  mustard_stalks: 1.2
};

// Environmental compensation for stubble burning (per incident), as notified Nov 2024
const fineForAcres = (acres) => (acres < 2 ? 5000 : acres <= 5 ? 10000 : 30000);

// Commonly cited losses per tonne of paddy straw burned (kg)
const NUTRIENTS_LOST_PER_T = { N: 5.5, P: 2.3, K: 25, S: 1.2 };
const PM_KG_PER_T = 3;

const inr = (n) => {
  const v = Math.round(n || 0);
  return `${v < 0 ? '−' : ''}₹${Math.abs(v).toLocaleString('en-IN')}`;
};
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const CROPS = Object.entries(RESIDUE_TYPES).filter(([key]) => RESIDUE_PER_ACRE[key]);

export const BurnVsSellScreen = ({ onScanRequest }) => {
  const [crop, setCrop] = useState('paddy_straw');
  const [acres, setAcres] = useState('5');
  const [perAcre, setPerAcre] = useState(String(RESIDUE_PER_ACRE.paddy_straw));
  const [price, setPrice] = useState(String((RESIDUE_TYPES.paddy_straw.pricePerTonMin + RESIDUE_TYPES.paddy_straw.pricePerTonMax) / 2));
  const [cost, setCost] = useState('800');

  const changeCrop = (key) => {
    const t = RESIDUE_TYPES[key];
    setCrop(key);
    setPerAcre(String(RESIDUE_PER_ACRE[key]));
    setPrice(String((t.pricePerTonMin + t.pricePerTonMax) / 2));
  };

  const r = useMemo(() => {
    const a = num(acres);
    const tonnes = a * num(perAcre);
    const gross = tonnes * num(price);
    const collection = tonnes * num(cost);
    const net = gross - collection;
    const fine = a > 0 ? fineForAcres(a) : 0;
    const co2 = tonnes * CO2_KG_PER_TONNE_BURNED;
    return {
      acres: a,
      tonnes,
      gross,
      collection,
      net,
      fine,
      co2,
      pm: tonnes * PM_KG_PER_T,
      points: Math.round(co2 / 10),
      nutrients: Object.fromEntries(Object.entries(NUTRIENTS_LOST_PER_T).map(([k, v]) => [k, v * tonnes])),
      advantage: net + fine
    };
  }, [acres, perAcre, price, cost]);

  const residueName = RESIDUE_TYPES[crop].residueType.toLowerCase();

  return (
    <div className="bvs-container">
      <div className="bvs-header">
        <h1 className="bvs-title">
          <Scale size={30} /> Burn vs Sell
        </h1>
        <p className="bvs-subtitle">See what burning your crop residue really costs – and what selling it can earn you.</p>
      </div>

      <div className="bvs-layout">
        {/* Inputs */}
        <form className="bvs-inputs" onSubmit={(e) => e.preventDefault()}>
          <h2 className="bvs-section-title">Your field</h2>

          <label className="bvs-field">
            <span>Crop residue</span>
            <select value={crop} onChange={(e) => changeCrop(e.target.value)}>
              {CROPS.map(([key, t]) => (
                <option key={key} value={key}>{t.residueType}</option>
              ))}
            </select>
          </label>

          <label className="bvs-field">
            <span>Field size (acres)</span>
            <input type="number" min="0" step="0.5" inputMode="decimal" value={acres} onChange={(e) => setAcres(e.target.value)} />
          </label>

          <label className="bvs-field">
            <span>Residue per acre (tonnes)</span>
            <input type="number" min="0" step="0.1" inputMode="decimal" value={perAcre} onChange={(e) => setPerAcre(e.target.value)} />
            <small>Typical for {residueName}; change it if you know yours.</small>
          </label>

          <label className="bvs-field">
            <span>Sale price (₹ per tonne)</span>
            <input type="number" min="0" step="50" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
            <small>
              Typical buyer range {inr(RESIDUE_TYPES[crop].pricePerTonMin)} – {inr(RESIDUE_TYPES[crop].pricePerTonMax)}
            </small>
          </label>

          <label className="bvs-field">
            <span>Baling &amp; transport cost (₹ per tonne)</span>
            <input type="number" min="0" step="50" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />
            <small>Set to 0 if the buyer collects it with their own baler.</small>
            {crop === 'paddy_straw' && (
              <small>
                Reported in Punjab and Haryana: straw sells for about ₹125–250 per quintal (₹1,250–2,500 per tonne), and baling costs about
                ₹1,000–1,500 per acre when you hire a baler. Rates change every season, so ask your nearest buyer before you decide.
              </small>
            )}
          </label>
        </form>

        {/* Results */}
        <div className="bvs-results">
          <div className={`bvs-verdict ${r.net < 0 ? 'bvs-verdict-warn' : ''}`}>
            {r.tonnes <= 0 ? (
              <p>Enter your field size to see the comparison.</p>
            ) : r.net >= 0 ? (
              <>
                <p className="bvs-verdict-label">Selling instead of burning puts you ahead by</p>
                <p className="bvs-verdict-amount">{inr(r.advantage)}</p>
                <p className="bvs-verdict-detail">
                  {inr(r.net)} from the sale plus a fine of up to {inr(r.fine)} you avoid.
                </p>
              </>
            ) : (
              <>
                <p className="bvs-verdict-label">At these rates, collection costs more than the sale earns</p>
                <p className="bvs-verdict-amount">{inr(r.net)}</p>
                <p className="bvs-verdict-detail">
                  Burning still risks a fine of up to {inr(r.fine)}. Look for a buyer who collects the residue themselves, or
                  use in-field options like a Happy Seeder or mulcher (often subsidised under the CRM scheme).
                </p>
              </>
            )}
          </div>

          <div className="bvs-compare">
            <div className="bvs-card bvs-card-sell">
              <h3><Leaf size={20} /> If you sell</h3>
              <dl>
                <div><dt>Residue</dt><dd>{r.tonnes.toLocaleString('en-IN', { maximumFractionDigits: 1 })} t</dd></div>
                <div><dt>Sale income</dt><dd>{inr(r.gross)}</dd></div>
                <div><dt><Truck size={14} /> Baling &amp; transport</dt><dd>− {inr(r.collection)}</dd></div>
                <div className="bvs-total"><dt>You keep</dt><dd>{inr(r.net)}</dd></div>
                <div><dt>CO₂ kept out of the air</dt><dd>{Math.round(r.co2).toLocaleString('en-IN')} kg</dd></div>
                <div><dt>AgriLoop carbon points</dt><dd>+{r.points.toLocaleString('en-IN')}</dd></div>
              </dl>
            </div>

            <div className="bvs-card bvs-card-burn">
              <h3><Flame size={20} /> If you burn</h3>
              <dl>
                <div><dt>Income</dt><dd>₹0</dd></div>
                <div><dt><AlertTriangle size={14} /> Fine if caught</dt><dd>up to {inr(r.fine)}</dd></div>
                <div>
                  <dt>Soil nutrients lost</dt>
                  <dd>
                    {Math.round(r.nutrients.N)} kg N · {Math.round(r.nutrients.P)} kg P · {Math.round(r.nutrients.K)} kg K
                  </dd>
                </div>
                <div><dt>CO₂ released</dt><dd>{Math.round(r.co2).toLocaleString('en-IN')} kg</dd></div>
                <div><dt><Wind size={14} /> Smoke particles (PM)</dt><dd>{Math.round(r.pm).toLocaleString('en-IN')} kg</dd></div>
              </dl>
            </div>
          </div>

          {r.tonnes > 0 && (
            <button className="bvs-cta" onClick={onScanRequest}>
              <IndianRupee size={18} /> Scan &amp; list your {residueName}
            </button>
          )}

          <p className="bvs-note">
            Estimates only. Fines are the environmental compensation notified in Nov 2024 (₹5,000 under 2 acres, ₹10,000 for
            2–5 acres, ₹30,000 above 5 acres per incident) – check current rules with your district office. Nutrient and smoke
            figures are commonly cited values for burning paddy straw; CO₂ uses ~1.46 t per tonne burned.
          </p>
        </div>
      </div>
    </div>
  );
};
