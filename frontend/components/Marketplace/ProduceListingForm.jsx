import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { api } from '../../utils/apiClient.js';
import { useAction } from '../../utils/hooks.js';
import { inr, todayIST } from '../../utils/format.js';
import { Modal } from '../Common/UI.jsx';
import { PriceGuidance } from '../Common/PriceGuidance.jsx';
import { resizeImageFile } from '../../utils/image.js';
import { useToast } from '../Common/Toast.jsx';

// Real mandi price from the AGMARKNET report (₹/quintal -> ₹/kg), clearly labelled as a reference
const useMandiReference = (crop) => {
  const [ref, setRef] = useState(null);
  useEffect(() => {
    setRef(null);
    if (!crop?.agmarknetName) return undefined;
    let cancelled = false;
    api(`/market/crop/${encodeURIComponent(crop.agmarknetName)}`)
      .then((r) => !cancelled && r.data && setRef({ perKg: r.data.price / 100, asOf: r.data.asOf, msp: r.data.msp ? r.data.msp / 100 : null }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [crop?.agmarknetName]);
  return ref;
};

// Create (listing = null) or edit an existing produce listing
export const ProduceListingForm = ({ crops, listing, onClose, onSaved }) => {
  const toast = useToast();
  const editing = Boolean(listing);
  const [busy, run] = useAction();
  const [error, setError] = useState('');
  const [f, setF] = useState(() => ({
    cropId: listing?.crop?.id || crops[0]?.id || '',
    title: listing?.title || '',
    description: listing?.description || '',
    quantity: listing ? String(listing.quantityAvailable) : '',
    unit: listing?.unit || 'kg',
    pricePerUnit: listing ? String(listing.pricePerUnit) : '',
    minOrderQuantity: listing ? String(listing.minOrderQuantity) : '10',
    harvestDate: listing?.harvestDate || todayIST(),
    qualityGrade: listing?.qualityGrade || 'A',
    location: listing?.location || '',
    image: null
  }));
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const crop = crops.find((c) => c.id === f.cropId);
  const mandi = useMandiReference(crop);

  const submit = () => {
    setError('');
    const quantity = Number(f.quantity);
    const price = Number(f.pricePerUnit);
    const min = Number(f.minOrderQuantity || 1);
    if (!(quantity >= 0) || (!editing && quantity <= 0)) return setError('Enter the quantity you have to sell.');
    if (!(price >= 0) || f.pricePerUnit === '') return setError('Enter a price per unit.');
    if (min > quantity && quantity > 0) return setError('Minimum order cannot be more than the quantity.');

    run(async () => {
      try {
        const body = editing
          ? {
              title: f.title || crop?.name,
              description: f.description,
              pricePerUnit: price,
              quantityAvailable: quantity,
              minOrderQuantity: min,
              qualityGrade: f.qualityGrade,
              harvestDate: f.harvestDate,
              ...(f.image ? { image: f.image } : {})
            }
          : {
              kind: 'PRODUCE',
              cropId: f.cropId,
              title: f.title || undefined,
              description: f.description,
              quantity,
              unit: f.unit,
              pricePerUnit: price,
              minOrderQuantity: min,
              harvestDate: f.harvestDate,
              qualityGrade: f.qualityGrade,
              location: f.location || undefined,
              image: f.image || undefined
            };
        const saved = editing
          ? await api(`/marketplace/listings/${listing.id}`, { method: 'PATCH', body })
          : await api('/marketplace/listings', { method: 'POST', body });
        toast.success(editing ? 'Listing updated.' : 'Your produce is now listed.');
        onSaved(saved);
      } catch (err) {
        setError(err.message);
      }
    });
  };

  return (
    <Modal
      title={editing ? 'Edit listing' : 'List your produce'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={submit}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish listing'}
          </button>
        </>
      }
    >
      <div className="ui-form-grid">
        <label className="ui-field">
          <span>Crop</span>
          <select value={f.cropId} onChange={set('cropId')} disabled={editing}>
            {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="ui-field">
          <span>Title (optional)</span>
          <input value={f.title} onChange={set('title')} placeholder={`e.g. Fresh ${crop?.name || 'produce'}`} maxLength={100} />
        </label>
        <label className="ui-field">
          <span>{editing ? 'Quantity available' : 'Quantity'}</span>
          <input type="number" min="0" step="1" inputMode="decimal" value={f.quantity} onChange={set('quantity')} placeholder="e.g. 300" />
        </label>
        <label className="ui-field">
          <span>Unit</span>
          <select value={f.unit} onChange={set('unit')} disabled={editing}>
            <option value="kg">kg</option>
            <option value="quintal">quintal (100 kg)</option>
            <option value="ton">tonne</option>
          </select>
        </label>
        <label className="ui-field">
          <span>Price per {f.unit} (₹)</span>
          <input type="number" min="0" step="0.5" inputMode="decimal" value={f.pricePerUnit} onChange={set('pricePerUnit')} placeholder="e.g. 25" />
          {!editing && f.cropId && <PriceGuidance cropId={f.cropId} grade={f.qualityGrade} unit={f.unit} onUse={(v) => setF((x) => ({ ...x, pricePerUnit: v }))} />}
          {mandi && f.unit === 'kg' && (
            <small className="market-ref">
              <Info size={12} /> Mandi average {inr(mandi.perKg, { decimals: 2 })}/kg (AGMARKNET, {mandi.asOf}){mandi.msp ? ` · MSP ${inr(mandi.msp, { decimals: 2 })}/kg` : ''}. Reference only – you set your price.
            </small>
          )}
        </label>
        <label className="ui-field">
          <span>Minimum order ({f.unit})</span>
          <input type="number" min="1" step="1" inputMode="decimal" value={f.minOrderQuantity} onChange={set('minOrderQuantity')} />
        </label>
        <label className="ui-field">
          <span>Harvest date</span>
          <input type="date" value={f.harvestDate} onChange={set('harvestDate')} />
        </label>
        <label className="ui-field">
          <span>Quality grade</span>
          <select value={f.qualityGrade} onChange={set('qualityGrade')}>
            <option value="A">A – premium</option>
            <option value="B">B – standard</option>
            <option value="C">C – fair</option>
            <option value="UNGRADED">Not graded</option>
          </select>
        </label>
        {!editing && (
          <label className="ui-field">
            <span>Pickup location</span>
            <input value={f.location} onChange={set('location')} placeholder="Defaults to your profile location" />
          </label>
        )}
        <label className="ui-field">
          <span>Photo (optional)</span>
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const image = await resizeImageFile(file);
                setF((s) => ({ ...s, image }));
              } catch (err) {
                setError(err.message);
              }
            }}
          />
        </label>
        <label className="ui-field ui-span-2">
          <span>Description</span>
          <textarea rows={3} maxLength={1000} value={f.description} onChange={set('description')} placeholder="Variety, size, packing, storage…" />
        </label>
      </div>
      {error && <p className="ui-field-error" role="alert">{error}</p>}
    </Modal>
  );
};
