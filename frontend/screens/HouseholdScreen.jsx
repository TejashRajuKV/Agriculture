import React, { useRef, useState } from 'react';
import { Trash2, Leaf, X, Camera, CheckCircle, History, Home } from 'lucide-react';
import { api } from '../utils/apiClient.js';
import { useApi, useAction } from '../utils/hooks.js';
import { resizeImageFile } from '../utils/image.js';
import { fmtDate } from '../utils/format.js';
import { StatusBadge, LoadingState, ErrorState } from '../components/Common/UI.jsx';
import { useToast } from '../components/Common/Toast.jsx';
import './HouseholdScreen.css';

const STAGE_LABEL = { OPEN: 'Waiting for a plant', CLAIMED: 'Plant is coming', COLLECTED: 'Collected', CANCELLED: 'Cancelled' };
const STAGE_TONE = { OPEN: 'warning', CLAIMED: 'info', COLLECTED: 'success', CANCELLED: 'danger' };

// Household waste pickup requests, saved on the server and visible to biogas plants
export const HouseholdScreen = ({ user }) => {
  const toast = useToast();
  const [degradability, setDegradability] = useState(null);
  const [image, setImage] = useState(null);
  const [weight, setWeight] = useState('');
  const [address, setAddress] = useState(user.location || '');
  const [error, setError] = useState('');
  const [busy, run] = useAction();
  const fileInputRef = useRef(null);

  const { data: requests, error: loadError, loading, reload } = useApi(() => api('/waste'), [], { pollMs: 20000 });
  const { data: dash, reload: reloadDash } = useApi(() => api('/dashboard'), []);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setImage(await resizeImageFile(file, 1024));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = () => {
    setError('');
    if (!degradability) return setError('Choose the type of waste.');
    if (!(Number(weight) > 0)) return setError('Enter the approximate weight in kg.');
    if (address.trim().length < 5) return setError('Enter the pickup address.');
    run(async () => {
      try {
        await api('/waste', { method: 'POST', body: { degradability, quantityKg: Number(weight), address, image: image || undefined } });
        toast.success('Pickup requested. Biogas plants nearby can now accept it.');
        setDegradability(null);
        setImage(null);
        setWeight('');
        reload({ quiet: true });
        reloadDash({ quiet: true });
      } catch (err) {
        setError(err.message);
      }
    });
  };

  const cancel = (r) =>
    run(async () => {
      try {
        await api(`/waste/${r.id}/cancel`, { method: 'POST' });
        toast.success('Pickup cancelled.');
        reload({ quiet: true });
      } catch (err) {
        toast.error(err.message);
      }
    });

  const w = dash?.waste;

  return (
    <div className="household-container">
      <div className="household-header">
        <div className="header-content">
          <h1 className="header-title"><Home size={32} /> Household Waste</h1>
          <p className="header-subtitle">Segregate your waste and hand it to a biogas plant. You earn carbon points for degradable waste that is actually collected.</p>
        </div>
        <div className="impact-card">
          <p className="impact-label">Collected so far</p>
          <p className="impact-value">{w ? w.collectedKg : '—'} <span className="impact-unit">kg</span></p>
          {w && <p className="impact-label">{w.collected} pickup{w.collected === 1 ? '' : 's'} · {user.carbonPoints} points</p>}
        </div>
      </div>

      <div className="household-grid">
        <div className="submission-form">
          <h2 className="form-title">Request a pickup</h2>

          <div className="type-selection">
            <label className="selection-label">Type of waste</label>
            <div className="type-buttons">
              <button type="button" onClick={() => setDegradability('DEGRADABLE')} className={`type-button ${degradability === 'DEGRADABLE' ? 'type-button-active-green' : 'type-button-inactive'}`}>
                <Leaf size={24} className={degradability === 'DEGRADABLE' ? 'icon-green' : 'icon-gray'} />
                <span className="type-title">Degradable</span>
                <span className="type-description">Food scraps, peels, vegetable waste</span>
              </button>
              <button type="button" onClick={() => setDegradability('NON_DEGRADABLE')} className={`type-button ${degradability === 'NON_DEGRADABLE' ? 'type-button-active-red' : 'type-button-inactive'}`}>
                <Trash2 size={24} className={degradability === 'NON_DEGRADABLE' ? 'icon-red' : 'icon-gray'} />
                <span className="type-title">Non-degradable</span>
                <span className="type-description">Plastic, metal, glass</span>
              </button>
            </div>
            {degradability === 'NON_DEGRADABLE' && (
              <p className="household-note">Biogas plants can only take degradable waste. Non-degradable requests stay listed but are unlikely to be collected – please use your local recycler.</p>
            )}
          </div>

          <div className="image-upload">
            <label className="upload-label">Photo (optional)</label>
            {!image ? (
              <div onClick={() => fileInputRef.current?.click()} className="upload-area" role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}>
                <Camera className="upload-icon" size={32} />
                <p className="upload-text">Tap to take or choose a picture</p>
              </div>
            ) : (
              <div className="image-preview">
                <img src={image} className="preview-img" alt="Waste" />
                <button type="button" onClick={() => setImage(null)} className="remove-btn" aria-label="Remove photo"><X size={16} /></button>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="file-input" accept="image/*" onChange={handleFileChange} />
          </div>

          <div className="details-section">
            <div className="input-group">
              <label className="input-label" htmlFor="hh-weight">Approx. weight (kg)</label>
              <input id="hh-weight" type="number" min="0" step="0.5" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="form-input" placeholder="e.g. 2.5" />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="hh-address">Pickup address</label>
              <input id="hh-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="form-input" placeholder="House no., street, town" />
            </div>
          </div>

          {error && <p className="household-error" role="alert">{error}</p>}
          <button type="button" className="submit-btn" onClick={handleSubmit} disabled={busy}>
            {busy ? 'Sending…' : 'Request pickup'}
          </button>
        </div>

        <div className="history-section">
          <div className="history-card">
            <h2 className="history-title"><History size={20} /> My pickups</h2>
            {loading && !requests && <LoadingState text="Loading your pickups…" />}
            {loadError && !requests && <ErrorState error={loadError} onRetry={reload} />}
            {requests?.length === 0 && (
              <div className="empty-state">
                <Leaf size={48} className="empty-icon" />
                <p className="empty-text">No pickups yet.</p>
                <p className="empty-subtext">Request one and it will show here.</p>
              </div>
            )}
            <div className="contributions-list">
              {requests?.map((item) => (
                <div key={item.id} className="contribution-item">
                  {item.image && <img src={item.image} className="contribution-image" alt="waste" />}
                  <div className="contribution-content">
                    <div className="contribution-header">
                      <h4 className="contribution-title">{item.degradability === 'DEGRADABLE' ? 'Degradable waste' : 'Non-degradable'}</h4>
                      <StatusBadge status={item.stage} label={STAGE_LABEL[item.stage]} tone={STAGE_TONE[item.stage]} />
                    </div>
                    <p className="contribution-meta">{item.quantityKg} kg · {fmtDate(item.createdAt)} · {item.address}</p>
                    {item.stage === 'CLAIMED' && <p className="biogas-note"><CheckCircle size={12} /> {item.collectedByName} will collect it</p>}
                    {item.stage === 'COLLECTED' && (
                      <p className="biogas-note"><CheckCircle size={12} /> Collected by {item.collectedByName}{item.pointsEarned ? ` · +${item.pointsEarned} carbon points` : ''}</p>
                    )}
                    {item.stage === 'OPEN' && (
                      <button type="button" className="household-cancel" disabled={busy} onClick={() => cancel(item)}>Cancel pickup</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
