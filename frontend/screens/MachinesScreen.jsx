import React, { useState } from 'react';
import { Truck, Plus } from 'lucide-react';
import { api, qs } from '../utils/apiClient.js';
import { useApi, useAction } from '../utils/hooks.js';
import { fmtDate, inr, todayIST, addDaysIso } from '../utils/format.js';
import { StatusBadge, EmptyState, LoadingState, ErrorState } from '../components/Common/UI.jsx';
import { useToast } from '../components/Common/Toast.jsx';
import './ProcurementScreen.css';
import './PhaseFour.css';

const TYPES = { TRACTOR: 'Tractor', BALER: 'Baler', COMBINE_HARVESTER: 'Combine harvester', HAPPY_SEEDER: 'Happy Seeder', ROTAVATOR: 'Rotavator', SPRAYER: 'Sprayer', OTHER: 'Other' };
const UNITS = { PER_HOUR: 'hour', PER_ACRE: 'acre', PER_DAY: 'day' };

// Rent farm machines from neighbours by the day. Money is settled directly with the owner.
export const MachinesScreen = ({ user }) => {
  const [view, setView] = useState('browse');
  return (
    <div className="proc-container">
      <div className="proc-header">
        <div>
          <h1 className="ui-page-title"><Truck size={30} /> Machine rental</h1>
          <p className="ui-page-sub">Rent a tractor, baler or seeder from a nearby farmer for the days you need it. You pay the owner directly.</p>
        </div>
        <div className="ui-tabs" role="tablist" aria-label="Machine rental">
          {[['browse', 'Find a machine'], ['requests', 'My requests'], ['mine', 'My machines']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={view === k} className={`ui-tab ${view === k ? 'active' : ''}`} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
      </div>
      {view === 'browse' && <Browse user={user} />}
      {view === 'requests' && <Requests as="renter" />}
      {view === 'mine' && <MyMachines user={user} />}
    </div>
  );
};

const Browse = () => {
  const toast = useToast();
  const [type, setType] = useState('');
  const [open, setOpen] = useState(null);
  const { data, error, loading, reload } = useApi(() => api(`/machines${qs({ type })}`), [type], { cacheKey: `machines:${type}` });
  return (
    <>
      <label className="ui-field p4-filter"><span>Type</span>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All machines</option>
          {Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      {loading && !data && <LoadingState text="Looking for machines…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && !data.length && <EmptyState icon={Truck} title="No machines listed" text="Try another type, or list your own machine." />}
      <div className="p4-grid">
        {data?.map((m) => (
          <article key={m.id} className="ui-card p4-card">
            <h3>{m.name}</h3>
            <p className="proc-hint">{TYPES[m.type]} · {m.district}, {m.state} · {m.owner.name}</p>
            <p><strong>{inr(m.rate)}</strong> per {UNITS[m.rateUnit]}</p>
            {m.description && <p className="proc-hint">{m.description}</p>}
            {!m.mine && <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setOpen(open === m.id ? null : m.id)}>{open === m.id ? 'Close' : 'Ask to rent'}</button>}
            {m.mine && <span className="proc-hint">This is yours</span>}
            {open === m.id && <RentForm machine={m} onDone={() => { setOpen(null); toast.success('Request sent. The owner will confirm.'); }} />}
          </article>
        ))}
      </div>
    </>
  );
};

const RentForm = ({ machine, onDone }) => {
  const toast = useToast();
  const [busy, run] = useAction();
  const [date, setDate] = useState(addDaysIso(todayIST(), 1));
  const [quantity, setQuantity] = useState('');
  const { data } = useApi(() => api(`/machines/${machine.id}/availability`), [machine.id]);
  const taken = data?.bookedDates.includes(date);
  const total = Number(quantity) > 0 ? machine.rate * Number(quantity) : null;
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      try {
        await api(`/machines/${machine.id}/book`, { method: 'POST', body: { date, quantity: Number(quantity) } });
        onDone();
      } catch (err) {
        toast.error(err.message);
      }
    });
  };
  return (
    <form className="p4-form" onSubmit={submit}>
      <label className="ui-field"><span>Day</span><input type="date" min={todayIST()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
      {taken && <p className="ui-field-error">Already booked that day.</p>}
      <label className="ui-field"><span>How many {UNITS[machine.rateUnit]}s</span><input type="number" min="0.5" step="0.5" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
      {total != null && <p className="proc-hint">About {inr(total)}, paid to the owner. Fuel and driver may be extra, so ask.</p>}
      <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy || taken || !quantity}>Send request</button>
    </form>
  );
};

const Requests = ({ as }) => {
  const toast = useToast();
  const [busy, run] = useAction();
  const { data, error, loading, reload } = useApi(() => api(`/machines/bookings${qs({ as })}`), [as], { pollMs: 20000, cacheKey: `machine-bookings:${as}` });
  const act = (id, action, message) => run(async () => {
    try {
      await api(`/machines/bookings/${id}/${action}`, { method: 'POST' });
      toast.success(message);
      await reload({ quiet: true });
    } catch (err) {
      toast.error(err.message);
    }
  });
  if (loading && !data) return <LoadingState text="Loading…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data.length) return <EmptyState icon={Truck} title={as === 'owner' ? 'No requests yet' : 'No requests yet'} text={as === 'owner' ? 'Requests for your machines show up here.' : 'Machines you ask for show up here.'} />;
  return (
    <ul className="p4-list">
      {data.map((b) => (
        <li key={b.id} className="ui-card p4-row">
          <div>
            <strong>{b.machineName}</strong>
            <p className="proc-hint">{fmtDate(b.date)} · {b.quantity} {UNITS[b.rateUnit]}(s) · about {inr(b.estimatedTotal)}{as === 'owner' ? ` · ${b.renter.name}` : ''}</p>
          </div>
          <div className="p4-actions">
            <StatusBadge status={b.status} />
            {as === 'owner' && b.status === 'REQUESTED' && (
              <>
                <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy} onClick={() => act(b.id, 'accept', 'Confirmed. The renter is told.')}>Accept</button>
                <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" disabled={busy} onClick={() => act(b.id, 'decline', 'Declined.')}>Decline</button>
              </>
            )}
            {as === 'owner' && b.status === 'ACCEPTED' && b.date <= todayIST() && (
              <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" disabled={busy} onClick={() => act(b.id, 'complete', 'Marked done.')}>Job done</button>
            )}
            {['REQUESTED', 'ACCEPTED'].includes(b.status) && (
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" disabled={busy} onClick={() => window.confirm('Cancel this booking?') && act(b.id, 'cancel', 'Cancelled.')}>Cancel</button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

const MyMachines = ({ user }) => {
  const toast = useToast();
  const [busy, run] = useAction();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', type: 'TRACTOR', rate: '', rateUnit: 'PER_HOUR', description: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const { data, reload } = useApi(() => api('/machines?mine=true'), []);
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      try {
        await api('/machines', { method: 'POST', body: { ...f, rate: Number(f.rate) } });
        toast.success('Machine listed.');
        setAdding(false);
        setF({ name: '', type: 'TRACTOR', rate: '', rateUnit: 'PER_HOUR', description: '' });
        reload({ quiet: true });
      } catch (err) {
        toast.error(err.message);
      }
    });
  };
  const toggle = (m) => run(async () => {
    try {
      await api(`/machines/${m.id}`, { method: 'PATCH', body: { active: !m.active } });
      reload({ quiet: true });
    } catch (err) {
      toast.error(err.message);
    }
  });
  return (
    <div className="p4-stack">
      <button type="button" className="ui-btn ui-btn-primary p4-self-start" onClick={() => setAdding((a) => !a)}><Plus size={16} /> List a machine</button>
      {adding && (
        <form className="ui-card ui-form-grid" onSubmit={submit} noValidate>
          <label className="ui-field"><span>Name</span><input value={f.name} onChange={set('name')} placeholder="e.g. Mahindra 475 tractor" /></label>
          <label className="ui-field"><span>Type</span><select value={f.type} onChange={set('type')}>{Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="ui-field"><span>Rate (₹)</span><input type="number" min="0" value={f.rate} onChange={set('rate')} /></label>
          <label className="ui-field"><span>Charged per</span><select value={f.rateUnit} onChange={set('rateUnit')}>{Object.entries(UNITS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="ui-field ui-span-2"><span>Details (driver, diesel, conditions)</span><input value={f.description} onChange={set('description')} /></label>
          <p className="proc-hint ui-span-2">Shown under {user.location || 'your profile location'}. Set your location in your profile first.</p>
          <div className="ui-span-2"><button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>Save machine</button></div>
        </form>
      )}
      <ul className="p4-list">
        {data?.map((m) => (
          <li key={m.id} className="ui-card p4-row">
            <div><strong>{m.name}</strong><p className="proc-hint">{TYPES[m.type]} · {inr(m.rate)} per {UNITS[m.rateUnit]} · {m.district}, {m.state}</p></div>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" disabled={busy} onClick={() => toggle(m)}>{m.active ? 'Pause listing' : 'Show again'}</button>
          </li>
        ))}
      </ul>
      <h2 className="ui-card-title">Requests for my machines</h2>
      <Requests as="owner" />
    </div>
  );
};
