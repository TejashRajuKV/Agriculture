import React, { useState } from 'react';
import { ClipboardList, Megaphone, Scale, BadgeCheck, CheckCircle2, UserX, LogIn, IndianRupee, RefreshCw, Users } from 'lucide-react';
import { api, qs } from '../utils/apiClient.js';
import { useApi, useAction } from '../utils/hooks.js';
import { addDaysIso, fmtDate, inr, minutesLabel, qty, todayIST } from '../utils/format.js';
import { StatusBadge, Stat, EmptyState, LoadingState, ErrorState } from '../components/Common/UI.jsx';
import { useToast } from '../components/Common/Toast.jsx';
import { ArrivalsForecast } from '../components/Common/ArrivalsForecast.jsx';
import './ProcurementScreen.css';
import './ManagerProcurementScreen.css';

const STAGES = [
  ['WAITING', 'Waiting'],
  ['WEIGHING', 'Weighing'],
  ['QUALITY_CHECK', 'Quality check'],
  ['DECIDED', 'Accepted / rejected'],
  ['PAYMENT', 'Payment pending']
];

export const ManagerProcurementScreen = () => {
  const toast = useToast();
  const [centerId, setCenterId] = useState('');
  const [busy, run] = useAction();
  const { data, error, loading, reload } = useApi(() => api(`/manager/overview${qs({ centerId })}`), [centerId], { pollMs: 5000 });

  if (loading && !data) return <LoadingState text="Loading today's procurement…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const act = (path, body, message) =>
    run(async () => {
      try {
        await api(path, { method: 'POST', body });
        if (message) toast.success(message);
        await reload({ quiet: true });
        return true;
      } catch (err) {
        toast.error(err.message);
        return false;
      }
    });

  const { stats, utilization, queue, center } = data;
  const countersFull = queue.countersBusy >= queue.counters;
  const stageCount = {
    WAITING: stats.waiting,
    WEIGHING: data.active.filter((r) => r.procurement?.status === 'WEIGHING').length,
    QUALITY_CHECK: data.active.filter((r) => r.procurement?.status === 'QUALITY_CHECK').length,
    DECIDED: data.active.filter((r) => ['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED'].includes(r.procurement?.status)).length,
    PAYMENT: stats.pendingPayments
  };
  const notArrived = data.bookings.filter((b) => b.queueStatus === 'NOT_JOINED');

  return (
    <div className="proc-container mgr">
      <div className="proc-header">
        <div>
          <h1 className="ui-page-title"><ClipboardList size={30} /> Procurement desk</h1>
          <p className="ui-page-sub">{center.name} · {fmtDate(data.date)} · open {center.openingTime}–{center.closingTime} · {center.counters} counter{center.counters > 1 ? 's' : ''}</p>
        </div>
        <div className="mgr-head-actions">
          {data.centers.length > 1 && (
            <label className="ui-field mgr-center-select">
              <span>Centre</span>
              <select value={centerId || center.id} onChange={(e) => setCenterId(e.target.value)}>
                {data.centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className="ui-btn ui-btn-ghost" onClick={() => reload({ quiet: true })} aria-label="Refresh">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Today's overview */}
      <section className="mgr-stats">
        <Stat label="Bookings today" value={stats.totalBookings} hint={`${stats.checkedIn} checked in · ${stats.notArrived} not arrived`} />
        <Stat label="Waiting" value={stats.waiting} tone="info" hint={`clears in ~${minutesLabel(queue.estimatedClearMinutes)}`} />
        <Stat label="At the counters" value={stats.processing} tone="warning" hint={`${queue.countersBusy} of ${queue.counters} busy`} />
        <Stat label="Completed" value={stats.completed} tone="success" hint={`avg ${stats.averageProcessingMinutes} min each`} />
        <Stat label="Procured today" value={qty(stats.quantityProcuredKg)} />
        <Stat label="Value procured" value={inr(stats.procurementValue)} />
        <Stat label="Payments pending" value={stats.pendingPayments} tone={stats.pendingPayments ? 'warning' : undefined} hint={inr(stats.pendingPaymentAmount)} />
      </section>

      <section className="ui-card mgr-util">
        <div className="mgr-util-head">
          <strong>Centre utilisation</strong>
          <span>{utilization.processed} processed · {utilization.booked} booked · {utilization.remaining} slots left of {utilization.dailyCapacity}</span>
        </div>
        <div className="mgr-bar" role="img" aria-label={`${utilization.percent}% processed, ${utilization.bookedPercent}% booked`}>
          <span className="mgr-bar-booked" style={{ width: `${Math.min(100, utilization.bookedPercent)}%` }} />
          <span className="mgr-bar-done" style={{ width: `${Math.min(100, utilization.percent)}%` }} />
        </div>
        <div className="mgr-pipeline">
          {STAGES.map(([key, label], i) => (
            <React.Fragment key={key}>
              {i > 0 && <span className="mgr-arrow" aria-hidden="true">→</span>}
              <div className="mgr-stage">
                <strong>{stageCount[key]}</strong>
                <span>{label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </section>

      <div className="mgr-grid">
        {/* Queue */}
        <section className="ui-card">
          <div className="mgr-queue-head">
            <h2 className="ui-card-title"><Users size={20} /> Queue</h2>
            <div className="mgr-serving">
              <span>Now serving</span>
              <strong>{queue.nowServing || '—'}</strong>
            </div>
          </div>
          <button
            type="button"
            className="ui-btn ui-btn-primary ui-btn-lg mgr-callnext"
            disabled={busy || !queue.waitingCount || countersFull}
            onClick={() => act('/manager/queue/call-next', { centerId: center.id }, 'Next farmer called.')}
          >
            <Megaphone size={18} /> Call next{queue.next[0] ? ` · ${queue.next[0].token}` : ''}
          </button>
          {countersFull && queue.waitingCount > 0 && <p className="proc-hint">All counters are busy – finish a farmer to call the next one.</p>}
          {queue.next.length === 0 ? (
            <EmptyState title="Nobody waiting" text="Farmers join the queue when they check in." />
          ) : (
            <ol className="mgr-next">
              {queue.next.map((r) => (
                <li key={r.bookingId}>
                  <span className="proc-token">{r.token.slice(-3)}</span>
                  <span className="mgr-next-main">
                    <strong>{r.farmer}</strong>
                    <span>{r.crop} · {qty(r.estimatedQuantity)} · slot {r.slot}</span>
                  </span>
                  <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" disabled={busy || countersFull} onClick={() => act(`/manager/queue/${r.bookingId}/call`, undefined, `Called ${r.token}.`)}>
                    Call
                  </button>
                </li>
              ))}
            </ol>
          )}
          {queue.waitingCount > queue.next.length && <p className="proc-hint">+ {queue.waitingCount - queue.next.length} more waiting</p>}
        </section>

        {/* Counters */}
        <section className="ui-card">
          <h2 className="ui-card-title"><Scale size={20} /> At the counters</h2>
          {data.active.length === 0 ? (
            <EmptyState title="Counters are free" text="Call the next farmer from the queue." />
          ) : (
            <div className="mgr-counters">
              {data.active.map((r) => (
                <CounterCard key={r.bookingId} row={r} cropPrices={center.cropPrices} busy={busy} act={act} />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mgr-grid">
        <section className="ui-card">
          <h2 className="ui-card-title"><LogIn size={20} /> Expected, not yet arrived ({notArrived.length})</h2>
          {notArrived.length === 0 ? (
            <p className="proc-hint">Everyone booked today has checked in.</p>
          ) : (
            <ul className="mgr-arrivals">
              {notArrived.map((r) => (
                <li key={r.bookingId}>
                  <span className="proc-token">{r.token.slice(-3)}</span>
                  <span className="mgr-next-main">
                    <strong>{r.farmer}</strong>
                    <span>{r.slot} · {r.crop} · {qty(r.estimatedQuantity)}</span>
                  </span>
                  <span className="mgr-row-actions">
                    <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" disabled={busy} onClick={() => act(`/manager/queue/${r.bookingId}/check-in`, undefined, `${r.farmer} checked in.`)}>
                      Check in
                    </button>
                    <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" disabled={busy} onClick={() => window.confirm(`Mark ${r.token} as no-show?`) && act(`/manager/queue/${r.bookingId}/skip`, undefined, 'Marked as no-show.')}>
                      No-show
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <PaymentsPanel payments={data.payments} busy={busy} act={act} />
        <ArrivalsPanel center={center} />
        <AssistedBooking center={center} onBooked={() => reload({ quiet: true })} />
        <PricesPanel center={center} busy={busy} act={act} />
      </div>
    </div>
  );
};

// One farmer at a counter: shows only the next valid step
const CounterCard = ({ row, cropPrices, busy, act }) => {
  const p = row.procurement;
  const defaultPrice = cropPrices.find((c) => c.cropId === row.cropId)?.pricePerKg ?? '';
  const [weight, setWeight] = useState(String(row.estimatedQuantity));
  const [grade, setGrade] = useState('A');
  const [accepted, setAccepted] = useState('');
  const [price, setPrice] = useState(String(defaultPrice));
  const [notes, setNotes] = useState('');
  const acceptedValue = accepted === '' ? p?.weighedQuantity ?? '' : accepted;
  const amount = grade === 'REJECT' ? 0 : Number(acceptedValue) * Number(price);

  return (
    <article className="mgr-counter">
      <div className="mgr-counter-head">
        <span className="proc-token">{row.token}</span>
        <div className="mgr-next-main">
          <strong>{row.farmer}</strong>
          <span>{row.crop} · declared {qty(row.estimatedQuantity)}</span>
        </div>
        <StatusBadge status={p ? p.status : row.queueStatus} />
      </div>

      {row.queueStatus === 'CALLED' && (
        <div className="mgr-step">
          <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={() => act(`/manager/procurement/${row.bookingId}/start`, undefined, `Weighing ${row.token}.`)}>
            <Scale size={16} /> Farmer is here – start weighing
          </button>
          <button type="button" className="ui-btn ui-btn-ghost" disabled={busy} onClick={() => window.confirm(`Mark ${row.token} as no-show?`) && act(`/manager/queue/${row.bookingId}/skip`, undefined, 'Marked as no-show.')}>
            <UserX size={16} /> No-show
          </button>
        </div>
      )}

      {p?.status === 'WEIGHING' && (
        <form
          className="mgr-step"
          onSubmit={(e) => {
            e.preventDefault();
            act(`/manager/procurement/${row.bookingId}/weight`, { weighedQuantity: Number(weight) }, 'Weight recorded.');
          }}
        >
          <label className="ui-field">
            <span>Weight on scale (kg)</span>
            <input type="number" min="0" step="0.1" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} required />
          </label>
          <button type="submit" className="ui-btn ui-btn-primary" disabled={busy || !(Number(weight) > 0)}>Record weight</button>
        </form>
      )}

      {p?.status === 'QUALITY_CHECK' && (
        <form
          className="mgr-step mgr-quality"
          onSubmit={(e) => {
            e.preventDefault();
            act(
              `/manager/procurement/${row.bookingId}/quality`,
              { qualityGrade: grade, acceptedQuantity: grade === 'REJECT' ? 0 : Number(acceptedValue), pricePerKg: Number(price), qualityNotes: notes },
              'Quality recorded.'
            );
          }}
        >
          <p className="proc-hint">Weighed: <strong>{qty(p.weighedQuantity)}</strong></p>
          <div className="ui-form-grid">
            <label className="ui-field">
              <span>Grade</span>
              <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="A">A – best</option>
                <option value="B">B – good</option>
                <option value="C">C – fair</option>
                <option value="REJECT">Reject lot</option>
              </select>
            </label>
            <label className="ui-field">
              <span>Accepted (kg)</span>
              <input type="number" min="0" max={p.weighedQuantity} step="0.1" value={grade === 'REJECT' ? 0 : acceptedValue} disabled={grade === 'REJECT'} onChange={(e) => setAccepted(e.target.value)} />
            </label>
            <label className="ui-field">
              <span>Price (₹/kg)</span>
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label className="ui-field">
              <span>Notes</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 28 kg bruised" maxLength={200} />
            </label>
          </div>
          <div className="mgr-amount">
            <span>{grade === 'REJECT' ? 'Nothing accepted' : `${qty(Number(acceptedValue) || 0)} × ${inr(Number(price) || 0, { decimals: 2 })}`}</span>
            <strong>{inr(amount || 0, { decimals: 2 })}</strong>
          </div>
          <button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>
            <BadgeCheck size={16} /> Save quality decision
          </button>
        </form>
      )}

      {['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED'].includes(p?.status) && (
        <div className="mgr-step">
          <p className="proc-hint">
            {p.acceptedQuantity ? <>Accepted <strong>{qty(p.acceptedQuantity)}</strong> grade {p.qualityGrade} = <strong>{inr(p.totalAmount, { decimals: 2 })}</strong></> : 'Lot rejected – no payment.'}
          </p>
          <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={() => act(`/manager/procurement/${row.bookingId}/complete`, undefined, 'Procurement completed, payment started.')}>
            <CheckCircle2 size={16} /> Complete & start payment
          </button>
        </div>
      )}
    </article>
  );
};

const ArrivalsPanel = ({ center }) => {
  const [cropId, setCropId] = useState(center.cropPrices[0]?.cropId || '');
  return (
    <section className="ui-card">
      <h2 className="ui-card-title"><Scale size={20} /> Expected arrivals, next 7 days</h2>
      <label className="ui-field" style={{ maxWidth: 240 }}><span>Crop</span>
        <select value={cropId} onChange={(e) => setCropId(e.target.value)}>{center.cropPrices.map((c) => <option key={c.cropId} value={c.cropId}>{c.crop}</option>)}</select>
      </label>
      {cropId && <ArrivalsForecast centerId={center.id} cropId={cropId} />}
    </section>
  );
};

// A farmer phones or walks in without a smartphone: the desk books the slot for them by mobile number
const AssistedBooking = ({ center, onBooked }) => {
  const toast = useToast();
  const [busy, run] = useAction();
  const [f, setF] = useState({ phone: '', date: todayIST(), slotId: '', cropId: center.cropPrices[0]?.cropId || '', qty: '', farmerCode: '' });
  const [needCode, setNeedCode] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const { data } = useApi(() => api(`/procurement-centers/${center.id}/slots?date=${f.date}`), [center.id, f.date]);
  const free = (data?.slots || []).filter((s) => s.available && !s.past);

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      try {
        const b = await api('/manager/assisted-booking', {
          method: 'POST',
          body: { phone: f.phone, slotId: f.slotId, cropId: f.cropId, estimatedQuantity: Number(f.qty), ...(f.farmerCode ? { farmerCode: f.farmerCode } : {}) }
        });
        toast.success(`Booked. Token ${b.token}. The farmer gets an SMS.`);
        setF((x) => ({ ...x, phone: '', qty: '', slotId: '', farmerCode: '' }));
        setNeedCode(null);
        onBooked();
      } catch (err) {
        if (err.status === 409 && err.details?.farmers) setNeedCode(err.details.farmers);
        toast.error(err.message);
      }
    });
  };

  return (
    <section className="ui-card">
      <h2 className="ui-card-title"><Users size={20} /> Book for a farmer</h2>
      <p className="proc-hint">For farmers without a smartphone. They need an AgriLoop account with this mobile number.</p>
      <form className="ui-form-grid" onSubmit={submit} noValidate>
        <label className="ui-field"><span>Farmer's mobile number</span><input type="tel" inputMode="numeric" value={f.phone} onChange={set('phone')} placeholder="10 digits" /></label>
        {needCode && (
          <label className="ui-field"><span>More than one farmer uses this number. Pick one:</span>
            <select value={f.farmerCode} onChange={set('farmerCode')}>
              <option value="">Choose…</option>
              {needCode.map((x) => <option key={x.farmerCode} value={x.farmerCode}>{x.name} ({x.farmerCode})</option>)}
            </select>
          </label>
        )}
        <label className="ui-field"><span>Day</span>
          <select value={f.date} onChange={(e) => setF((x) => ({ ...x, date: e.target.value, slotId: '' }))}>
            {Array.from({ length: 7 }, (_, i) => addDaysIso(todayIST(), i)).map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}
          </select>
        </label>
        <label className="ui-field"><span>Time</span>
          <select value={f.slotId} onChange={set('slotId')}>
            <option value="">{free.length ? 'Choose a slot…' : 'No free slots'}</option>
            {free.map((s) => <option key={s.id} value={s.id}>{s.startTime} ({s.remaining} left)</option>)}
          </select>
        </label>
        <label className="ui-field"><span>Crop</span>
          <select value={f.cropId} onChange={set('cropId')}>{center.cropPrices.map((c) => <option key={c.cropId} value={c.cropId}>{c.crop}</option>)}</select>
        </label>
        <label className="ui-field"><span>Quantity (kg)</span><input type="number" min="1" value={f.qty} onChange={set('qty')} /></label>
        <div className="ui-span-2"><button type="submit" className="ui-btn ui-btn-primary" disabled={busy || !f.phone || !f.slotId || !f.qty}>{busy ? 'Booking…' : 'Book & send SMS'}</button></div>
      </form>
    </section>
  );
};

const DELAY_OPTIONS = [
  ['BANK_DETAILS_MISMATCH', 'Bank details do not match'],
  ['ACCOUNT_NOT_LINKED', 'Account not linked for direct payment'],
  ['FUNDS_PENDING', 'Waiting for funds'],
  ['RECORD_VERIFICATION', 'Land / farmer record being verified'],
  ['BANK_TECHNICAL', 'Bank or system problem'],
  ['OTHER', 'Other']
];

// What the centre pays per kg and the moisture limit; farmers see this before they book
const PricesPanel = ({ center, busy, act }) => {
  const [edits, setEdits] = useState({});
  const val = (c, k) => edits[c.cropId]?.[k] ?? c[k] ?? '';
  const set = (id, k, v) => setEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  return (
    <section className="ui-card">
      <h2 className="ui-card-title"><IndianRupee size={20} /> Buying price & moisture limit</h2>
      <p className="proc-hint">Farmers see these before booking. Update when your rate or limit changes.</p>
      <ul className="mgr-arrivals">
        {center.cropPrices.map((c) => (
          <li key={c.cropId}>
            <strong>{c.crop}</strong>
            <span className="mgr-row-actions">
              <label className="ui-field"><span>₹/kg</span><input type="number" min="0" step="0.05" value={val(c, 'pricePerKg')} onChange={(e) => set(c.cropId, 'pricePerKg', e.target.value)} style={{ width: 90 }} /></label>
              <label className="ui-field"><span>Moisture ≤ %</span><input type="number" min="1" max="60" step="0.5" value={val(c, 'maxMoisturePct')} onChange={(e) => set(c.cropId, 'maxMoisturePct', e.target.value)} style={{ width: 90 }} /></label>
              <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" disabled={busy || !edits[c.cropId]} onClick={async () => { if (await act(`/manager/centers/${center.id}/prices`, { cropId: c.cropId, pricePerKg: val(c, 'pricePerKg'), maxMoisturePct: val(c, 'maxMoisturePct') }, `${c.crop} price saved.`)) setEdits((e) => { const n = { ...e }; delete n[c.cropId]; return n; }); }}>
                Save
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

const DelayPicker = ({ p, busy, act }) => {
  const [code, setCode] = useState('');
  return (
    <span className="mgr-row-actions">
      <select aria-label="Delay reason" value={code} onChange={(e) => setCode(e.target.value)}>
        <option value="">{p.delay ? `Reason: ${p.delay.label}` : 'Note a delay reason…'}</option>
        {DELAY_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" disabled={busy || !code} onClick={async () => { if (await act(`/manager/payment/${p.id}/delay`, { code }, 'Reason shared with the farmer.')) setCode(''); }}>
        Tell farmer
      </button>
    </span>
  );
};

const PaymentsPanel = ({ payments, busy, act }) => (
  <section className="ui-card">
    <h2 className="ui-card-title"><IndianRupee size={20} /> Payments to settle ({payments.length})</h2>
    {payments.length === 0 ? (
      <p className="proc-hint">All payments are settled.</p>
    ) : (
      <ul className="mgr-arrivals">
        {payments.map((p) => (
          <li key={p.id}>
            <span className="mgr-next-main">
              <strong>{p.farmer} · {inr(p.amount, { decimals: 2 })}</strong>
              <span>{p.recordNumber} · {p.crop} {p.acceptedQuantity ? `· ${qty(p.acceptedQuantity)}` : ''}{p.failureReason ? ` · ${p.failureReason}` : ''}</span>
            </span>
            <span className="mgr-row-actions">
              <StatusBadge status={p.status} />
              {p.status === 'PROCESSING' && (
                <>
                  <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy} onClick={() => act(`/manager/payment/${p.id}/update`, { status: 'PAID' }, 'Marked as paid.')}>
                    Mark paid
                  </button>
                  <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" disabled={busy} onClick={() => act(`/manager/payment/${p.id}/update`, { status: 'FAILED', reason: 'Bank transfer failed' }, 'Marked as failed.')}>
                    Failed
                  </button>
                </>
              )}
              {['FAILED', 'PENDING'].includes(p.status) && (
                <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" disabled={busy} onClick={() => act(`/manager/payment/${p.id}/update`, { status: 'PROCESSING' }, 'Payment retried.')}>
                  Retry
                </button>
              )}
              {p.status !== 'PAID' && <DelayPicker p={p} busy={busy} act={act} />}
            </span>
          </li>
        ))}
      </ul>
    )}
    <p className="proc-note">Payments are simulated in this demo; a bank/UPI provider plugs into the same buttons.</p>
  </section>
);
