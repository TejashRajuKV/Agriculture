import React from 'react';
import { Users, Clock, Hourglass, IndianRupee, MapPin, LogIn, XCircle, Info } from 'lucide-react';
import { api } from '../../utils/apiClient.js';
import { useApi, useAction } from '../../utils/hooks.js';
import { fmtDate, fmtDateTime, inr, minutesLabel, qty } from '../../utils/format.js';
import { StatusBadge, Timeline, LoadingState, ErrorState } from '../Common/UI.jsx';
import { useToast } from '../Common/Toast.jsx';

const LIVE = ['WAITING', 'CALLED', 'PROCESSING'];

// Live queue + procurement timeline + payment for one booking (all from the database)
export const BookingDetail = ({ bookingId }) => {
  const toast = useToast();
  const [busy, run] = useAction();
  const { data: b, error, loading, reload } = useApi(() => api(`/procurement/bookings/${bookingId}`), [bookingId], { pollMs: 5000 });

  if (loading && !b) return <LoadingState text="Loading your booking…" />;
  if (error && !b) return <ErrorState error={error} onRetry={reload} />;

  const act = (path, message) =>
    run(async () => {
      try {
        await api(`/procurement/bookings/${bookingId}/${path}`, { method: 'POST' });
        toast.success(message);
        reload({ quiet: true });
      } catch (err) {
        toast.error(err.message);
      }
    });

  const q = b.queue;
  const live = LIVE.includes(b.queueStatus);
  const r = b.procurement;
  const p = b.payment;

  return (
    <div className="proc-detail">
      <section className={`ui-card proc-queue ${b.queueStatus === 'CALLED' ? 'proc-queue-called' : ''}`} aria-live="polite">
        <div className="proc-queue-head">
          <div>
            <p className="proc-label">Procurement {b.bookingNumber}</p>
            <h2 className="proc-queue-title">
              {b.crop.name} · {qty(b.estimatedQuantity)}
            </h2>
            <p className="proc-hint"><MapPin size={14} /> {b.center.name} · {fmtDate(b.date)}, {b.slot.start}–{b.slot.end}</p>
          </div>
          <StatusBadge status={b.status === 'CONFIRMED' ? b.queueStatus : b.status} />
        </div>

        <div className="proc-queue-grid">
          <div className="proc-queue-tile proc-queue-mine">
            <span>Your token</span>
            <strong>{b.token}</strong>
          </div>
          <div className="proc-queue-tile">
            <span>Now serving</span>
            <strong>{q.nowServing || '—'}</strong>
          </div>
          <div className="proc-queue-tile">
            <span><Users size={14} /> People ahead</span>
            <strong>{b.queueStatus === 'WAITING' ? q.peopleAhead : '—'}</strong>
          </div>
          <div className="proc-queue-tile">
            <span><Hourglass size={14} /> Estimated wait</span>
            <strong>{b.queueStatus === 'WAITING' ? minutesLabel(q.estimatedWaitMinutes) : '—'}</strong>
          </div>
        </div>

        {b.queueStatus === 'CALLED' && <p className="proc-called-banner">Your token has been called. Please go to the weighing counter now.</p>}
        {b.queueStatus === 'NOT_JOINED' && b.status === 'CONFIRMED' && (
          <p className="proc-hint">
            {b.canCheckIn ? 'When you reach the centre, press “I’ve arrived” to join the queue.' : `You can join the queue on ${fmtDate(b.date)} when you reach the centre.`}
          </p>
        )}
        {live && (
          <p className="proc-explain">
            <Info size={14} /> Wait = {q.peopleAhead} ahead × {q.calculation.averageProcessingMinutes} min ÷ {q.calculation.counters} counter
            {q.calculation.counters > 1 ? 's' : ''} ({q.calculation.basis}). Updates every few seconds.
          </p>
        )}

        {(b.canCheckIn || b.canCancel) && (
          <div className="proc-actions">
            {b.canCheckIn && (
              <button type="button" className="ui-btn ui-btn-primary ui-btn-lg" disabled={busy} onClick={() => act('check-in', 'You are in the queue.')}>
                <LogIn size={18} /> I've arrived
              </button>
            )}
            {b.canCancel && (
              <button
                type="button"
                className="ui-btn ui-btn-danger"
                disabled={busy}
                onClick={() => window.confirm('Cancel this booking? Your slot will be given to someone else.') && act('cancel', 'Booking cancelled.')}
              >
                <XCircle size={16} /> Cancel booking
              </button>
            )}
          </div>
        )}
      </section>

      <div className="proc-detail-grid">
        <section className="ui-card">
          <h2 className="ui-card-title"><Clock size={20} /> Status</h2>
          <Timeline steps={b.timeline} />
        </section>

        <div className="proc-detail-side">
          <section className="ui-card">
            <h2 className="ui-card-title">Weighing & quality</h2>
            {r ? (
              <dl className="proc-kv">
                <div><dt>Declared</dt><dd>{qty(r.declaredQuantity)}</dd></div>
                <div><dt>Weighed</dt><dd>{qty(r.weighedQuantity)}</dd></div>
                <div><dt>Accepted</dt><dd>{qty(r.acceptedQuantity)}</dd></div>
                <div><dt>Rejected</dt><dd>{qty(r.rejectedQuantity)}</dd></div>
                <div><dt>Quality grade</dt><dd>{r.qualityGrade || '—'}</dd></div>
                <div><dt>Price</dt><dd>{r.pricePerKg != null ? `${inr(r.pricePerKg, { decimals: 2 })}/kg` : '—'}</dd></div>
                {r.qualityNotes && <div className="proc-kv-wide"><dt>Notes</dt><dd>{r.qualityNotes}</dd></div>}
                <div className="proc-kv-total"><dt>Amount</dt><dd>{r.totalAmount != null ? inr(r.totalAmount, { decimals: 2 }) : '—'}</dd></div>
              </dl>
            ) : (
              <p className="proc-hint">Details appear here once your lot is on the scale.</p>
            )}
          </section>

          <section className="ui-card">
            <h2 className="ui-card-title"><IndianRupee size={20} /> Payment</h2>
            {p ? (
              <dl className="proc-kv">
                <div><dt>Status</dt><dd><StatusBadge status={p.status} /></dd></div>
                <div><dt>Amount</dt><dd>{inr(p.amount, { decimals: 2 })}</dd></div>
                <div><dt>Method</dt><dd>{p.method.replace(/_/g, ' ').toLowerCase()}</dd></div>
                <div><dt>Reference</dt><dd className="proc-mono">{p.transactionRef || '—'}</dd></div>
                <div><dt>Paid on</dt><dd>{p.paidAt ? fmtDateTime(p.paidAt) : '—'}</dd></div>
                {p.failureReason && <div className="proc-kv-wide"><dt>Problem</dt><dd>{p.failureReason}</dd></div>}
              </dl>
            ) : (
              <p className="proc-hint">{r?.acceptedQuantity === 0 ? 'Nothing was accepted, so there is no payment.' : 'Payment starts when procurement is completed.'}</p>
            )}
            {p?.provider === 'SIMULATED' && <p className="proc-note">Demo payments are simulated – no real money moves.</p>}
          </section>
        </div>
      </div>
    </div>
  );
};
