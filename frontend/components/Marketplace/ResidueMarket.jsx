import React, { useState } from 'react';
import { Gavel, CheckCircle2, XCircle, Truck, Clock, BadgeCheck, Leaf } from 'lucide-react';
import { api, qs } from '../../utils/apiClient.js';
import { useApi, useAction } from '../../utils/hooks.js';
import { fmtDate, inr, todayIST, addDaysIso } from '../../utils/format.js';
import { Modal, EmptyState, LoadingState, ErrorState } from '../Common/UI.jsx';
import { useToast } from '../Common/Toast.jsx';

// Crop residue sold by bidding: buyer bids -> farmer accepts -> pickup -> complete.
// All rules (one bid per buyer, private bids, money transfer) are enforced by the API.

const FALLBACK_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="440"><rect width="100%" height="100%" fill="#fefce8"/><text x="50%" y="50%" fill="#a16207" font-family="sans-serif" font-size="28" text-anchor="middle" dominant-baseline="middle">Crop residue</text></svg>'
  );

const STATUS_LABEL = { ACTIVE: 'Open for bids', RESERVED: 'Pickup pending', SOLD_OUT: 'Sold' };

export const ResidueMarket = ({ user, onScanRequest }) => {
  const toast = useToast();
  const isSeller = ['FARMER', 'FPO'].includes(user.role);
  const isBuyer = user.role === 'BUYER';
  const [filter, setFilter] = useState('all');
  const [bidTarget, setBidTarget] = useState(null);
  const [busy, run] = useAction();

  const { data, error, loading, reload } = useApi(
    () => api(`/marketplace/listings${qs({ kind: 'RESIDUE', mine: filter === 'mine' && isSeller ? 1 : undefined, mybids: filter === 'mine' && isBuyer ? 1 : undefined })}`),
    [filter],
    { pollMs: 20000 }
  );

  const act = (fn, message) =>
    run(async () => {
      try {
        await fn();
        if (message) toast.success(message);
        await reload({ quiet: true });
      } catch (err) {
        toast.error(err.message);
      }
    });

  return (
    <>
      <div className="market-toolbar">
        {(isSeller || isBuyer) && (
          <div className="ui-tabs" role="tablist" aria-label="Filter residue listings">
            <button role="tab" aria-selected={filter === 'all'} className={`ui-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All lots</button>
            <button role="tab" aria-selected={filter === 'mine'} className={`ui-tab ${filter === 'mine' ? 'active' : ''}`} onClick={() => setFilter('mine')}>
              {isSeller ? 'My lots' : 'My bids'}
            </button>
          </div>
        )}
        {isSeller && (
          <button type="button" className="ui-btn ui-btn-primary" onClick={onScanRequest}>
            <Leaf size={16} /> Scan & list residue
          </button>
        )}
      </div>

      {loading && !data && <LoadingState text="Loading crop residue lots…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState
          title={filter === 'mine' ? (isSeller ? 'You have no residue lots' : 'You have not bid on anything yet') : 'No crop residue listed'}
          text={isSeller ? 'Scan your straw or stalks to create a lot instead of burning it.' : 'New lots appear here as farmers list them.'}
        />
      )}

      <div className="marketplace-grid">
        {data?.map((l) => (
          <ResidueCard
            key={l.id}
            listing={l}
            isBuyer={isBuyer}
            busy={busy}
            onBid={() => setBidTarget(l)}
            onWithdraw={() => act(() => api(`/marketplace/listings/${l.id}/bids/mine`, { method: 'DELETE' }), 'Bid withdrawn.')}
            onAccept={(bidId) => act(() => api(`/marketplace/listings/${l.id}/bids/${bidId}/accept`, { method: 'POST' }), 'Bid accepted. The buyer has been told to collect.')}
            onReject={(bidId) => act(() => api(`/marketplace/listings/${l.id}/bids/${bidId}/reject`, { method: 'POST' }), 'Bid declined.')}
            onComplete={() => act(() => api(`/marketplace/listings/${l.id}/complete`, { method: 'POST' }), 'Sale completed and payment recorded.')}
          />
        ))}
      </div>

      {bidTarget && (
        <BidDialog
          listing={bidTarget}
          onClose={() => setBidTarget(null)}
          onSubmit={(bid) =>
            act(async () => {
              await api(`/marketplace/listings/${bidTarget.id}/bids`, { method: 'POST', body: bid });
              setBidTarget(null);
            }, bidTarget.myBid ? 'Bid updated.' : 'Bid placed. The farmer has been notified.')
          }
          busy={busy}
        />
      )}
    </>
  );
};

const ResidueCard = ({ listing: l, isBuyer, busy, onBid, onWithdraw, onAccept, onReject, onComplete }) => {
  const [open, setOpen] = useState(false);
  const total = (bid) => inr(bid.pricePerTon * l.quantityListed);
  const statusClass = { ACTIVE: 'open', RESERVED: 'pending-pickup', SOLD_OUT: 'completed' }[l.status] || 'open';
  const mine = l.myBid;
  const iWon = mine && l.acceptedBid && mine.id === l.acceptedBid.id;

  return (
    <div className="listing-card">
      <div className="listing-image-container">
        <img src={l.image || FALLBACK_IMAGE} alt={l.title} className="listing-image" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }} />
        <span className={`listing-status listing-status-${statusClass}`}>{STATUS_LABEL[l.status] || l.status}</span>
        {l.isOwn && <span className="listing-own-badge">Your lot</span>}
      </div>
      <div className="listing-content">
        <h3 className="listing-title">{l.title}</h3>
        <p className="listing-farmer">By {l.seller.name}</p>
        <p className="listing-location">{l.location}</p>
        <div className="listing-footer">
          <span className="listing-price">{l.analysis?.estimatedPriceRange || '—'}</span>
          <span className="listing-quantity">{l.quantityListed} tons</span>
        </div>
        {l.status === 'ACTIVE' && (
          <p className="listing-bid-summary">
            <Gavel size={14} /> {l.bidCount === 0 ? 'No bids yet' : `${l.bidCount} bid${l.bidCount > 1 ? 's' : ''} · highest ${inr(l.highestBid)}/t`}
          </p>
        )}

        <div className="listing-actions">
          {/* Seller */}
          {l.isOwn && l.status === 'ACTIVE' && l.bids?.filter((b) => b.status === 'PENDING').length > 0 && (
            <>
              <button className="deal-btn deal-btn-outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
                {open ? 'Hide bids' : `Review ${l.bids.filter((b) => b.status === 'PENDING').length} bid(s)`}
              </button>
              {open && (
                <ul className="bid-list">
                  {[...l.bids].filter((b) => b.status === 'PENDING').sort((a, b) => b.pricePerTon - a.pricePerTon).map((b) => (
                    <li key={b.id} className="bid-row">
                      <div className="bid-row-main">
                        <p className="bid-buyer">{b.buyerName}</p>
                        <p className="bid-price">{inr(b.pricePerTon)}/t <span>= {total(b)}</span></p>
                        <p className="bid-meta"><Clock size={12} /> Pickup {fmtDate(b.pickupDate)}</p>
                        {b.message && <p className="bid-message">“{b.message}”</p>}
                      </div>
                      <div className="bid-row-actions">
                        <button className="deal-btn deal-btn-primary deal-btn-sm" disabled={busy} onClick={() => onAccept(b.id)}><CheckCircle2 size={14} /> Accept</button>
                        <button className="deal-btn deal-btn-ghost deal-btn-sm" disabled={busy} onClick={() => onReject(b.id)}><XCircle size={14} /> Decline</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {l.isOwn && l.status === 'RESERVED' && l.acceptedBid && (
            <>
              <p className="deal-note"><Truck size={16} /><span>Accepted <strong>{l.acceptedBid.buyerName}</strong> at {inr(l.acceptedBid.pricePerTon)}/t. Pickup {fmtDate(l.acceptedBid.pickupDate)} · you receive <strong>{total(l.acceptedBid)}</strong>.</span></p>
              <button className="deal-btn deal-btn-primary" disabled={busy} onClick={onComplete}><CheckCircle2 size={16} /> Mark picked up &amp; paid</button>
            </>
          )}
          {l.isOwn && l.status === 'SOLD_OUT' && l.acceptedBid && (
            <p className="deal-note deal-note-done"><BadgeCheck size={16} /><span>Sold to {l.acceptedBid.buyerName} for <strong>{total(l.acceptedBid)}</strong> · +{(l.carbonPoints || 0).toLocaleString('en-IN')} carbon points</span></p>
          )}

          {/* Buyer */}
          {isBuyer && !l.isOwn && l.status === 'ACTIVE' && !mine && (
            <button className="deal-btn deal-btn-primary" disabled={busy} onClick={onBid}><Gavel size={16} /> Place bid</button>
          )}
          {isBuyer && l.status === 'ACTIVE' && mine?.status === 'PENDING' && (
            <>
              <p className="deal-note"><Clock size={16} /><span>Your bid: <strong>{inr(mine.pricePerTon)}/t</strong> ({total(mine)}) – waiting for the farmer.</span></p>
              <div className="deal-btn-row">
                <button className="deal-btn deal-btn-outline" disabled={busy} onClick={onBid}>Edit bid</button>
                <button className="deal-btn deal-btn-ghost" disabled={busy} onClick={onWithdraw}>Withdraw</button>
              </div>
            </>
          )}
          {isBuyer && l.status === 'ACTIVE' && mine?.status === 'REJECTED' && (
            <>
              <p className="deal-note deal-note-muted">Your bid of {inr(mine.pricePerTon)}/t was declined.</p>
              <button className="deal-btn deal-btn-primary" disabled={busy} onClick={onBid}><Gavel size={16} /> Bid again</button>
            </>
          )}
          {isBuyer && l.status === 'RESERVED' && (iWon ? (
            <>
              <p className="deal-note"><Truck size={16} /><span>Bid accepted! Collect on {fmtDate(mine.pickupDate)} and pay <strong>{total(mine)}</strong> on pickup.</span></p>
              <button className="deal-btn deal-btn-primary" disabled={busy} onClick={onComplete}><CheckCircle2 size={16} /> Confirm pickup &amp; pay</button>
            </>
          ) : <p className="deal-note deal-note-muted">Reserved for another buyer.</p>)}
          {!l.isOwn && l.status === 'SOLD_OUT' && (
            <p className={`deal-note ${iWon ? 'deal-note-done' : 'deal-note-muted'}`}>
              {iWon ? <><BadgeCheck size={16} /> You bought this for {total(mine)}.</> : l.acceptedBid ? `Sold for ${inr(l.acceptedBid.pricePerTon)}/t.` : 'Sold.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const BidDialog = ({ listing, onClose, onSubmit, busy }) => {
  const min = listing.analysis?.pricePerTonMin;
  const max = listing.analysis?.pricePerTonMax;
  const [price, setPrice] = useState(String(listing.myBid?.pricePerTon || min || ''));
  const [pickupDate, setPickupDate] = useState(listing.myBid?.pickupDate || addDaysIso(todayIST(), 3));
  const [message, setMessage] = useState(listing.myBid?.message || '');
  const n = Number(price);
  const valid = Number.isFinite(n) && n > 0 && pickupDate >= todayIST();

  return (
    <Modal
      title={listing.myBid ? 'Update your bid' : 'Place a bid'}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="ui-btn ui-btn-primary" disabled={!valid || busy} onClick={() => onSubmit({ pricePerTon: n, pickupDate, message })}>
            <Gavel size={16} /> {listing.myBid ? 'Update bid' : 'Submit bid'}
          </button>
        </>
      }
    >
      <p className="proc-hint">{listing.title} · {listing.quantityListed} t · {listing.location}</p>
      <label className="ui-field">
        <span>Your price per tonne (₹)</span>
        <input type="number" min="1" step="50" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
        {min && max && <small>Typical range: {inr(min)} – {inr(max)} per tonne</small>}
      </label>
      <label className="ui-field">
        <span>Pickup date</span>
        <input type="date" min={todayIST()} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
      </label>
      <label className="ui-field">
        <span>Message to the farmer (optional)</span>
        <textarea rows={2} maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. We bring our own baler and truck" />
      </label>
      <div className="bid-total">
        <span>Total for {listing.quantityListed} t</span>
        <strong>{valid ? inr(n * listing.quantityListed) : '—'}</strong>
      </div>
      {valid && min && n < min && <p className="bid-warning">This is below the typical range – the farmer may decline it.</p>}
    </Modal>
  );
};
