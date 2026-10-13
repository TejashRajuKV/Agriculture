import React, { useState } from 'react';
import { ShoppingCart, Phone, MapPin } from 'lucide-react';
import { api } from '../../utils/apiClient.js';
import { useApi, useAction } from '../../utils/hooks.js';
import { fmtDate, inr, qty } from '../../utils/format.js';
import { Modal, LoadingState } from '../Common/UI.jsx';
import { useToast } from '../Common/Toast.jsx';

// Listing details + order form. Stock is checked again on the server when the order is placed.
export const OrderDialog = ({ listingId, canOrder, defaultAddress, onClose, onOrdered }) => {
  const toast = useToast();
  const { data: l, error } = useApi(() => api(`/marketplace/listings/${listingId}`), [listingId]);
  const [quantity, setQuantity] = useState('');
  const [address, setAddress] = useState(defaultAddress || '');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, run] = useAction();

  const n = Number(quantity);
  const min = l ? Math.min(l.minOrderQuantity, l.quantityAvailable) : 0;
  const valid = l && Number.isFinite(n) && n >= min && n > 0 && n <= l.quantityAvailable && address.trim().length >= 5;

  const place = () =>
    run(async () => {
      setFormError('');
      try {
        const order = await api('/orders', { method: 'POST', body: { listingId, quantity: n, deliveryAddress: address, notes } });
        toast.success(`Order ${order.orderNumber} placed. The seller has been notified.`);
        onOrdered(order);
      } catch (err) {
        setFormError(err.message);
      }
    });

  return (
    <Modal
      title={l ? l.title : 'Listing'}
      onClose={onClose}
      size="md"
      footer={
        canOrder && l?.status === 'ACTIVE' && !l?.isOwn ? (
          <>
            <button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>Close</button>
            <button type="button" className="ui-btn ui-btn-primary" disabled={!valid || busy} onClick={place}>
              <ShoppingCart size={16} /> {busy ? 'Placing…' : `Place order${valid ? ` · ${inr(n * l.pricePerUnit, { decimals: 2 })}` : ''}`}
            </button>
          </>
        ) : (
          <button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>Close</button>
        )
      }
    >
      {!l && !error && <LoadingState />}
      {error && <p className="ui-field-error">{error.message}</p>}
      {l && (
        <>
          <dl className="proc-kv">
            <div><dt>Seller</dt><dd>{l.seller.name}{l.seller.type === 'FPO' ? ' (FPO)' : ''}</dd></div>
            <div><dt>Price</dt><dd>{inr(l.pricePerUnit, { decimals: 2 })}/{l.unit}</dd></div>
            <div><dt>Available</dt><dd>{qty(l.quantityAvailable, l.unit)}</dd></div>
            <div><dt>Minimum order</dt><dd>{qty(l.minOrderQuantity, l.unit)}</dd></div>
            <div><dt>Quality</dt><dd>{l.qualityGrade === 'UNGRADED' ? 'Not graded' : `Grade ${l.qualityGrade}`}</dd></div>
            <div><dt>Harvested</dt><dd>{fmtDate(l.harvestDate)}</dd></div>
            {l.description && <div className="proc-kv-wide"><dt>About</dt><dd>{l.description}</dd></div>}
          </dl>
          {l.sellerContact && (
            <p className="market-contact">
              <MapPin size={14} /> Pickup: {l.location || l.sellerContact.location || '—'}
              {l.sellerContact.phone && <> · <Phone size={14} /> <a href={`tel:${l.sellerContact.phone}`}>{l.sellerContact.phone}</a></>}
            </p>
          )}

          {canOrder && !l.isOwn && l.status === 'ACTIVE' && (
            <div className="ui-form-grid">
              <label className="ui-field">
                <span>Quantity ({l.unit})</span>
                <input type="number" min={min} max={l.quantityAvailable} step="1" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={`${min} – ${l.quantityAvailable}`} />
                {quantity !== '' && n > l.quantityAvailable && <small className="ui-field-error">Only {qty(l.quantityAvailable, l.unit)} available.</small>}
                {quantity !== '' && n < min && <small className="ui-field-error">Minimum order is {qty(min, l.unit)}.</small>}
              </label>
              <label className="ui-field">
                <span>Total</span>
                <input readOnly value={Number.isFinite(n) && n > 0 ? inr(n * l.pricePerUnit, { decimals: 2 }) : '—'} aria-live="polite" />
                <small>Pay on delivery</small>
              </label>
              <label className="ui-field ui-span-2">
                <span>Delivery address</span>
                <textarea rows={2} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Business name, street, city, PIN" />
              </label>
              <label className="ui-field ui-span-2">
                <span>Note to seller (optional)</span>
                <input maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Deliver before 9 am" />
              </label>
            </div>
          )}
          {l.status !== 'ACTIVE' && <p className="proc-hint">This listing is {l.status.replace('_', ' ').toLowerCase()}.</p>}
          {formError && <p className="ui-field-error" role="alert">{formError}</p>}
        </>
      )}
    </Modal>
  );
};
