import React, { useMemo, useState } from 'react';
import { Truck, Navigation, PackageCheck, Plus, Play, X, MapPin } from 'lucide-react';
import { api } from '../utils/apiClient.js';
import { useApi, useAction } from '../utils/hooks.js';
import { fmtDate, inr, minutesLabel, qty, todayIST, addDaysIso } from '../utils/format.js';
import { StatusBadge, EmptyState, LoadingState, ErrorState } from '../components/Common/UI.jsx';
import { useToast } from '../components/Common/Toast.jsx';
import './ProcurementScreen.css';
import './PhaseFour.css';
import './LogisticsScreen.css';

const VEHICLE_TYPES = { PICKUP: 'Pickup', MINI_TRUCK: 'Mini truck', TRUCK: 'Truck' };

// Dispatcher desk: vehicles, orders waiting for pickup, route planning, and running the day's trips.
export const LogisticsScreen = () => {
  const [view, setView] = useState('plan');
  return (
    <div className="proc-container">
      <div className="proc-header">
        <div>
          <h1 className="ui-page-title"><Truck size={30} /> Logistics</h1>
          <p className="ui-page-sub">Group orders onto one vehicle, get a short valid route, and run the trip stop by stop.</p>
        </div>
        <div className="ui-tabs" role="tablist" aria-label="Logistics">
          {[['plan', 'Plan a trip'], ['trips', 'Trips'], ['fleet', 'Vehicles']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={view === k} className={`ui-tab ${view === k ? 'active' : ''}`} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
      </div>
      {view === 'plan' && <Plan onCreated={() => setView('trips')} />}
      {view === 'trips' && <Trips />}
      {view === 'fleet' && <Fleet />}
    </div>
  );
};

// ---------------------------------------------------------------- plan
const Plan = ({ onCreated }) => {
  const toast = useToast();
  const [busy, run] = useAction();
  const orders = useApi(() => api('/logistics/orders'), [], { pollMs: 20000 });
  const vehicles = useApi(() => api('/logistics/vehicles'), []);
  const [picked, setPicked] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [date, setDate] = useState(todayIST());
  const [preview, setPreview] = useState(null);
  const [problem, setProblem] = useState('');

  const usable = (vehicles.data || []).filter((v) => v.status !== 'MAINTENANCE');
  const vId = vehicleId || usable[0]?.id || '';
  const vehicle = usable.find((v) => v.id === vId);
  const chosen = (orders.data || []).filter((o) => picked.includes(o.id));
  const totalKg = chosen.reduce((s, o) => s + o.kg, 0);

  const toggle = (id) => { setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); setPreview(null); setProblem(''); };
  const body = { vehicleId: vId, date, orderIds: picked };

  const doPreview = () => run(async () => {
    setProblem('');
    try { setPreview(await api('/logistics/plan', { method: 'POST', body })); } catch (err) { setPreview(null); setProblem(err.message); }
  });
  const create = () => run(async () => {
    try {
      const t = await api('/logistics/deliveries', { method: 'POST', body });
      toast.success(`Trip ${t.number} created. Sellers and buyers are told.`);
      onCreated();
    } catch (err) {
      setProblem(err.message);
      orders.reload({ quiet: true });
    }
  });

  if (orders.loading && !orders.data) return <LoadingState text="Loading orders…" />;
  if (orders.error && !orders.data) return <ErrorState error={orders.error} onRetry={orders.reload} />;

  return (
    <div className="p4-stack">
      <section className="ui-card">
        <h2 className="ui-card-title"><PackageCheck size={20} /> Orders ready for pickup ({orders.data.length})</h2>
        {orders.data.length === 0 ? (
          <EmptyState icon={PackageCheck} title="Nothing waiting" text="Orders appear here when a seller marks them ready for pickup." />
        ) : (
          <ul className="lg-orders">
            {orders.data.map((o) => (
              <li key={o.id}>
                <label className={o.routable ? '' : 'lg-disabled'}>
                  <input type="checkbox" checked={picked.includes(o.id)} disabled={!o.routable} onChange={() => toggle(o.id)} />
                  <span>
                    <strong>{o.orderNumber} · {o.item} · {qty(o.kg)}</strong>
                    <small>{o.pickupLabel || 'no pickup position'} → {o.dropLabel || 'no drop position'} · {o.seller} to {o.buyer}</small>
                    {!o.routable && <small className="p4-warn">Seller or buyer has no map location. Ask them to set it in their profile.</small>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ui-card ui-form-grid">
        <label className="ui-field"><span>Vehicle</span>
          <select value={vId} onChange={(e) => { setVehicleId(e.target.value); setPreview(null); }}>
            {usable.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.plate} · {qty(v.capacityKg)}{v.status === 'ON_ROUTE' ? ' (on a trip)' : ''}</option>)}
          </select>
        </label>
        <label className="ui-field"><span>Day</span>
          <input type="date" min={todayIST()} max={addDaysIso(todayIST(), 14)} value={date} onChange={(e) => { setDate(e.target.value); setPreview(null); }} />
        </label>
        <p className="proc-hint ui-span-2">
          {picked.length} order{picked.length === 1 ? '' : 's'} selected, {qty(totalKg)} in total{vehicle ? `. The vehicle carries up to ${qty(vehicle.capacityKg)} at a time; it can deliver some orders before collecting others.` : '.'}
        </p>
        {problem && <p className="ui-field-error ui-span-2" role="alert">{problem}</p>}
        <div className="ui-span-2 lg-actions">
          <button type="button" className="ui-btn ui-btn-outline" disabled={busy || !picked.length || !vId} onClick={doPreview}><Navigation size={16} /> Find best route</button>
          {preview && <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={create}>Create trip</button>}
        </div>
      </section>

      {preview && <RoutePreview plan={preview} />}
    </div>
  );
};

const RoutePreview = ({ plan }) => (
  <section className="ui-card">
    <h2 className="ui-card-title"><Navigation size={20} /> Suggested route</h2>
    <div className="p4-stats">
      <div className="ui-stat"><strong>{plan.totalKm} km</strong><span>estimated distance</span></div>
      <div className="ui-stat"><strong>{minutesLabel(plan.durationMinutes)}</strong><span>estimated time</span></div>
      <div className="ui-stat"><strong>{qty(plan.peakLoadKg)}</strong><span>peak load</span></div>
      {plan.savedKm != null && <div className="ui-stat"><strong>{plan.savedKm} km</strong><span>saved vs one order at a time ({plan.naiveKm} km)</span></div>}
    </div>
    <RouteMap stops={plan.stops} />
    <StopList stops={plan.stops} />
    <p className="proc-hint">{plan.assumptions}</p>
  </section>
);

// Plain diagram: stops placed by their coordinates and joined in order. Not a street map.
const RouteMap = ({ stops, start }) => {
  const pts = [...(start ? [{ ...start, sequence: 0 }] : []), ...stops];
  const { xs, ys } = useMemo(() => ({ xs: pts.map((p) => p.lng), ys: pts.map((p) => p.lat) }), [pts]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 320;
  const H = 200;
  const pad = 22;
  const sx = (x) => pad + ((x - x0) / Math.max(x1 - x0, 1e-6)) * (W - 2 * pad);
  const sy = (y) => H - pad - ((y - y0) / Math.max(y1 - y0, 1e-6)) * (H - 2 * pad);
  return (
    <svg className="lg-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Navigation diagram">
      <polyline points={pts.map((p) => `${sx(p.lng)},${sy(p.lat)}`).join(' ')} fill="none" stroke="#3f8f4f" strokeWidth="2" strokeDasharray="4 3" />
      {stops.map((s) => (
        <g key={s.sequence} transform={`translate(${sx(s.lng)},${sy(s.lat)})`}>
          <circle r="10" fill={s.type === 'PICKUP' ? '#d9a441' : '#2f6f3e'} />
          <text textAnchor="middle" dy="4" fontSize="11" fill="#fff" fontWeight="700">{s.sequence}</text>
        </g>
      ))}
    </svg>
  );
};

const StopList = ({ stops, onDone, nextStop, busy }) => (
  <ol className="lg-stops">
    {stops.map((s) => (
      <li key={s.sequence} className={s.status === 'DONE' ? 'done' : s.sequence === nextStop ? 'next' : ''}>
        <span className={`lg-badge ${s.type === 'PICKUP' ? 'pick' : 'drop'}`}>{s.sequence}</span>
        <span className="lg-stop-main">
          <strong>{s.type === 'PICKUP' ? 'Collect' : 'Deliver'} {s.orderNumber} · {qty(s.kg)}</strong>
          <small><MapPin size={11} /> {s.label || 'location'} · {s.legKm} km · about {minutesLabel(s.etaMinutes)} after departure · load {qty(s.loadAfterKg)}</small>
        </span>
        {onDone && s.sequence === nextStop && <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy} onClick={() => onDone(s.sequence)}>Done</button>}
        {s.status === 'DONE' && <StatusBadge status="COMPLETED" label="Done" />}
      </li>
    ))}
  </ol>
);

// ---------------------------------------------------------------- trips
const Trips = () => {
  const toast = useToast();
  const [busy, run] = useAction();
  const { data, error, loading, reload } = useApi(() => api('/logistics/deliveries'), [], { pollMs: 10000 });
  const act = (path, message) => run(async () => {
    try { await api(path, { method: 'POST' }); toast.success(message); await reload({ quiet: true }); } catch (err) { toast.error(err.message); }
  });
  if (loading && !data) return <LoadingState text="Loading trips…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data.length) return <EmptyState icon={Truck} title="No trips yet" text="Plan a trip from the first tab." />;
  return (
    <ul className="p4-list">
      {data.map((t) => (
        <li key={t.id} className="ui-card lg-trip">
          <div className="p4-row">
            <div>
              <strong>{t.number} · {t.vehicle.name} ({t.vehicle.plate})</strong>
              <p className="proc-hint">{fmtDate(t.date)} · {t.totalKm} km · {t.stops.length} stops{t.savedKm ? ` · saves about ${t.savedKm} km` : ''}</p>
            </div>
            <div className="p4-actions">
              <StatusBadge status={t.status} />
              {t.status === 'PLANNED' && (
                <>
                  <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy || t.date > todayIST()} title={t.date > todayIST() ? 'Planned for a later day' : ''} onClick={() => act(`/logistics/deliveries/${t.id}/start`, 'Trip started.')}><Play size={14} /> Start</button>
                  <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" disabled={busy} onClick={() => window.confirm('Cancel this trip? Its orders go back to the waiting list.') && act(`/logistics/deliveries/${t.id}/cancel`, 'Trip cancelled.')}><X size={14} /> Cancel</button>
                </>
              )}
            </div>
          </div>
          {['PLANNED', 'IN_PROGRESS'].includes(t.status) && (
            <StopList stops={t.stops} nextStop={t.nextStop} busy={busy} onDone={t.status === 'IN_PROGRESS' ? (seq) => act(`/logistics/deliveries/${t.id}/stops/${seq}/complete`, seq === t.nextStop ? 'Stop done.' : '') : undefined} />
          )}
        </li>
      ))}
    </ul>
  );
};

// ---------------------------------------------------------------- fleet
const Fleet = () => {
  const toast = useToast();
  const [busy, run] = useAction();
  const { data, reload } = useApi(() => api('/logistics/vehicles'), []);
  const [f, setF] = useState({ name: '', plate: '', type: 'MINI_TRUCK', capacityKg: '' });
  const [adding, setAdding] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const add = (e) => {
    e.preventDefault();
    run(async () => {
      try {
        await api('/logistics/vehicles', { method: 'POST', body: { ...f, capacityKg: Number(f.capacityKg) } });
        toast.success('Vehicle added.');
        setAdding(false);
        setF({ name: '', plate: '', type: 'MINI_TRUCK', capacityKg: '' });
        reload({ quiet: true });
      } catch (err) { toast.error(err.message); }
    });
  };
  const setStatus = (v, status) => run(async () => {
    try { await api(`/logistics/vehicles/${v.id}`, { method: 'PATCH', body: { status } }); reload({ quiet: true }); } catch (err) { toast.error(err.message); }
  });
  return (
    <div className="p4-stack">
      <button type="button" className="ui-btn ui-btn-primary p4-self-start" onClick={() => setAdding((a) => !a)}><Plus size={16} /> Add a vehicle</button>
      {adding && (
        <form className="ui-card ui-form-grid" onSubmit={add} noValidate>
          <label className="ui-field"><span>Name</span><input value={f.name} onChange={set('name')} placeholder="e.g. Tata Ace" /></label>
          <label className="ui-field"><span>Registration number</span><input value={f.plate} onChange={set('plate')} placeholder="KA11A1234" /></label>
          <label className="ui-field"><span>Type</span><select value={f.type} onChange={set('type')}>{Object.entries(VEHICLE_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="ui-field"><span>Capacity (kg)</span><input type="number" min="50" value={f.capacityKg} onChange={set('capacityKg')} /></label>
          <p className="proc-hint ui-span-2">Trips start from your profile location, so set it before planning.</p>
          <div className="ui-span-2"><button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>Save vehicle</button></div>
        </form>
      )}
      <ul className="p4-list">
        {data?.map((v) => (
          <li key={v.id} className="ui-card p4-row">
            <div><strong>{v.name} · {v.plate}</strong><p className="proc-hint">{VEHICLE_TYPES[v.type]} · up to {qty(v.capacityKg)}</p></div>
            <div className="p4-actions">
              <StatusBadge status={v.status} />
              {v.status !== 'ON_ROUTE' && (
                <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" disabled={busy} onClick={() => setStatus(v, v.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE')}>
                  {v.status === 'MAINTENANCE' ? 'Back in service' : 'In maintenance'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
