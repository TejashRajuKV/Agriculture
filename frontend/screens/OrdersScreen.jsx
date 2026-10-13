import React, { useEffect, useState } from 'react';
import { Package, Truck, MapPin } from 'lucide-react';
import { api, qs } from '../utils/apiClient.js';
import { useApi, useAction } from '../utils/hooks.js';
import { fmtDateTime, inr, qty } from '../utils/format.js';
import { StatusBadge, EmptyState, LoadingState, ErrorState } from '../components/Common/UI.jsx';
import { useToast } from '../components/Common/Toast.jsx';
import { minutesLabel } from '../utils/format.js';
import './ProcurementScreen.css';
import './OrdersScreen.css';

const FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
const FLOW_LABEL = ['Placed', 'Confirmed', 'Packing', 'Ready', 'Picked up', 'On the way', 'Delivered'];
const ACTION_LABEL = {
  CONFIRMED: 'Accept order',
  PROCESSING: 'Start packing',
  READY_FOR_PICKUP: 'Ready for pickup',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'Out for delivery',
  DELIVERED: 'Confirm delivered',
  CANCELLED: 'Cancel order'
};

export const OrdersScreen = ({ user, highlightId }) => {
  const toast = useToast();
  const isSeller = ['FARMER', 'FPO'].includes(user.role);
  const [as, setAs] = useState(isSeller ? 'seller' : 'buyer');
  const [status, setStatus] = useState('open');
  const [busy, run] = useAction();
  const { data, error, loading, reload } = useApi(() => api(`/orders${qs({ as })}`), [as], { pollMs: 15000 });

  useEffect(() => {
    if (highlightId) document.getElementById(`order-${highlightId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightId, data]);

  const move = (o, next) => {
    if (next === 'CANCELLED' && !window.confirm(`Cancel order ${o.orderNumber}? The stock goes back to the listing.`)) return;
    run(async () => {
      try {
        await api(`/orders/${o.id}/status`, { method: 'PATCH', body: { status: next } });
        toast.success(`${o.orderNumber}: ${ACTION_LABEL[next].toLowerCase()}.`);
        reload({ quiet: true });
      } catch (err) {
        toast.error(err.message);
      }
    });
  };

  const visible = (data || []).filter((o) =>
    status === 'open' ? !['DELIVERED', 'CANCELLED'].includes(o.status) : status === 'done' ? ['DELIVERED', 'CANCELLED'].includes(o.status) : true
  );

  return (
    <div className="orders-container">
      <div className="proc-header">
        <div>
          <h1 className="ui-page-title"><Package size={30} /> Orders</h1>
          <p className="ui-page-sub">{as === 'seller' ? 'Orders buyers placed for your produce.' : 'Produce you bought directly from farmers and FPOs.'}</p>
        </div>
        <div className="orders-switches">
          {isSeller && (
            <div className="ui-tabs" role="tablist" aria-label="Orders as">
              <button role="tab" aria-selected={as === 'seller'} className={`ui-tab ${as === 'seller' ? 'active' : ''}`} onClick={() => setAs('seller')}>Sales</button>
              <button role="tab" aria-selected={as === 'buyer'} className={`ui-tab ${as === 'buyer' ? 'active' : ''}`} onClick={() => setAs('buyer')}>Purchases</button>
            </div>
          )}
          <div className="ui-tabs" role="tablist" aria-label="Order status">
            {[['open', 'Active'], ['done', 'Completed'], ['all', 'All']].map(([k, label]) => (
              <button key={k} role="tab" aria-selected={status === k} className={`ui-tab ${status === k ? 'active' : ''}`} onClick={() => setStatus(k)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {loading && !data && <LoadingState text="Loading orders…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && visible.length === 0 && (
        <EmptyState icon={Package} title="No orders here" text={as === 'seller' ? 'When buyers order your produce, it shows up here.' : 'Order produce from the marketplace to see it here.'} />
      )}

      <div className="orders-list">
        {visible.map((o) => {
          const step = FLOW.indexOf(o.status);
          const other = o.role === 'seller' ? o.buyer : o.seller;
          return (
            <article key={o.id} id={`order-${o.id}`} className={`ui-card order-card ${highlightId === o.id ? 'order-highlight' : ''}`}>
              <div className="order-head">
                <div>
                  <p className="proc-label">{o.orderNumber} · {fmtDateTime(o.createdAt)}</p>
                  <h2 className="order-title">{o.item.title} · {qty(o.quantity, o.item.unit)}</h2>
                  <p className="proc-hint">
                    {o.role === 'seller' ? 'Buyer' : 'Seller'}: <strong>{other.name}</strong>
                    {other.type && o.role === 'seller' && other.type !== 'INDIVIDUAL' ? ` (${other.type.toLowerCase()})` : ''}
                  </p>
                </div>
                <div className="order-amount">
                  <strong>{inr(o.totalAmount, { decimals: 2 })}</strong>
                  <span>{inr(o.unitPrice, { decimals: 2 })}/{o.item.unit}</span>
                  <StatusBadge status={o.paymentStatus === 'PAID' ? 'PAID' : o.status} label={o.paymentStatus === 'PAID' ? 'Paid' : undefined} />
                </div>
              </div>

              {o.status === 'CANCELLED' ? (
                <p className="order-cancelled">Cancelled</p>
              ) : (
                <ol className="order-steps" aria-label={`Order progress: ${FLOW_LABEL[step]}`}>
                  {FLOW.map((s, i) => (
                    <li key={s} className={i <= step ? 'done' : ''}>
                      <span className="order-dot" aria-hidden="true" />
                      <span className="order-step-label">{FLOW_LABEL[i]}</span>
                    </li>
                  ))}
                </ol>
              )}

              <p className="order-route">
                <MapPin size={14} /> {o.item.pickupLocation || '—'} <Truck size={14} /> {o.deliveryAddress}
              </p>
              {o.notes && <p className="proc-hint">Note: {o.notes}</p>}
              {o.delivery && <DeliveryTracking orderId={o.id} status={o.status} />}

              {o.nextActions.length > 0 && (
                <div className="order-actions">
                  {o.nextActions.map((next) => (
                    <button
                      key={next}
                      type="button"
                      className={`ui-btn ${next === 'CANCELLED' ? 'ui-btn-danger' : 'ui-btn-primary'}`}
                      disabled={busy}
                      onClick={() => move(o, next)}
                    >
                      {ACTION_LABEL[next]}
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

// What the delivery trip is doing for this order. Times are the plan, not a live GPS position.
const DeliveryTracking = ({ orderId, status }) => {
  const { data } = useApi(() => api(`/orders/${orderId}/tracking`), [orderId, status], { pollMs: 15000 });
  if (!data?.scheduled) return null;
  let line;
  if (data.deliveryDone) line = 'Delivered.';
  else if (data.tripStatus === 'PLANNED') line = `Pickup planned for ${data.date}.`;
  else if (data.pickupDone) line = data.stopsBefore === 0 ? 'On its way to you. You are the next stop.' : `On its way. ${data.stopsBefore} other stop${data.stopsBefore === 1 ? '' : 's'} before yours.`;
  else line = data.stopsBefore === 0 ? 'The vehicle is heading to collect it now.' : `${data.stopsBefore} stop${data.stopsBefore === 1 ? '' : 's'} before the pickup.`;
  return (
    <p className="order-route" role="status">
      <Truck size={14} /> Trip {data.number} · {data.plate}. {line}
      {!data.deliveryDone && data.tripStatus === 'IN_PROGRESS' && data.plannedEtaMinutes != null && <> Planned about {minutesLabel(data.plannedEtaMinutes)} after departure.</>}
    </p>
  );
};
