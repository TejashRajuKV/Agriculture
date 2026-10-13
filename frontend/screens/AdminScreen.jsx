import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Building2, Users, ScrollText, UserPlus } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api, qs } from '../utils/apiClient.js';
import { useApi, useAction } from '../utils/hooks.js';
import { fmtDateTime, inr, qty } from '../utils/format.js';
import { Stat, StatusBadge, EmptyState, LoadingState, ErrorState } from '../components/Common/UI.jsx';
import { useToast } from '../components/Common/Toast.jsx';
import './ProcurementScreen.css';
import './PhaseFour.css';
import './AdminScreen.css';

const TABS = [['overview', 'Overview', ShieldCheck], ['centres', 'Centres', Building2], ['people', 'People', Users], ['audit', 'Audit log', ScrollText]];
const ROLE_LABEL = { FARMER: 'Farmer', FPO: 'FPO', BUYER: 'Buyer', PROCUREMENT_MANAGER: 'Manager', LOGISTICS_OPERATOR: 'Logistics', ADMIN: 'Admin', HOUSEHOLD: 'Household', BIOGAS: 'Biogas plant', LEARNER: 'Learner', MARKET: 'Market viewer' };

export const AdminScreen = () => {
  const [tab, setTab] = useState('overview');
  return (
    <div className="proc-container">
      <div className="proc-header">
        <div>
          <h1 className="ui-page-title"><ShieldCheck size={30} /> Platform admin</h1>
          <p className="ui-page-sub">How the platform is doing, what needs attention, and who can do what. Numbers come straight from the database.</p>
        </div>
        <div className="ui-tabs" role="tablist" aria-label="Admin">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`ui-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
        </div>
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'centres' && <Centres />}
      {tab === 'people' && <People />}
      {tab === 'audit' && <Audit />}
    </div>
  );
};

const short = (d) => d.slice(5);

const Overview = () => {
  const { data, error, loading, reload } = useApi(() => api('/admin/overview'), [], { pollMs: 60000 });
  const att = useApi(() => api('/admin/attention'), [], { pollMs: 60000 });
  if (loading && !data) return <LoadingState text="Loading the platform numbers…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const { users, procurement: p, payments, marketplace: m, charts, logistics, fleet } = data;
  const p30 = p.last30Days;

  return (
    <div className="p4-stack">
      <section className="ui-card">
        <h2 className="ui-card-title"><AlertTriangle size={20} /> Needs attention</h2>
        {att.data && att.data.length === 0 && <p className="proc-hint">Nothing needs attention right now.</p>}
        <ul className="adm-attention">
          {att.data?.map((i, k) => <li key={k} className={i.severity.toLowerCase()}><StatusBadge status={i.severity === 'HIGH' ? 'FAILED' : i.severity === 'MEDIUM' ? 'PENDING' : 'OPEN'} label={i.severity.toLowerCase()} /> {i.text}</li>)}
        </ul>
      </section>

      <div className="p4-stats">
        <Stat label="People" value={users.total} hint={`${users.newLast30Days} new in 30 days${users.suspended ? `, ${users.suspended} suspended` : ''}`} />
        <Stat label="Procured, 30 days" value={qty(p30.procuredKg)} hint={inr(p30.procuredValue)} />
        <Stat label="Slot bookings, 30 days" value={p30.bookings} hint={`${p30.noShowRatePercent}% no-show`} />
        <Stat label="Marketplace sales, 30 days" value={inr(m.gmv30Days)} hint={`${m.delivered.count} orders delivered in all`} />
        <Stat label="Payments waiting" value={inr(payments.pending.amount)} hint={`${payments.pending.count} payments`} tone={payments.pending.count ? 'warning' : undefined} />
        <Stat label="Failed payments" value={payments.failed.count} hint={inr(payments.failed.amount)} tone={payments.failed.count ? 'warning' : undefined} />
      </div>

      <div className="adm-charts">
        <section className="ui-card">
          <h3 className="ui-card-title">Kg procured per day</h3>
          <div className="adm-chart"><ResponsiveContainer><AreaChart data={charts.procuredKg}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={short} tick={{ fontSize: 11 }} minTickGap={24} /><YAxis tick={{ fontSize: 11 }} width={46} /><Tooltip labelFormatter={(l) => l} formatter={(v) => [qty(v), 'Procured']} /><Area dataKey="kg" stroke="#3f8f4f" fill="#cfe7d3" /></AreaChart></ResponsiveContainer></div>
        </section>
        <section className="ui-card">
          <h3 className="ui-card-title">Slot bookings per day</h3>
          <div className="adm-chart"><ResponsiveContainer><BarChart data={charts.bookings}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={short} tick={{ fontSize: 11 }} minTickGap={24} /><YAxis tick={{ fontSize: 11 }} width={34} allowDecimals={false} /><Tooltip /><Bar dataKey="booked" name="Booked" fill="#d9a441" radius={[3, 3, 0, 0]} /><Bar dataKey="completed" name="Completed" fill="#3f8f4f" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </section>
        <section className="ui-card">
          <h3 className="ui-card-title">Marketplace sales per day</h3>
          <div className="adm-chart"><ResponsiveContainer><BarChart data={charts.orders}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={short} tick={{ fontSize: 11 }} minTickGap={24} /><YAxis tick={{ fontSize: 11 }} width={46} /><Tooltip formatter={(v, n) => [n === 'gmv' ? inr(v) : v, n === 'gmv' ? 'Sales' : 'Orders']} /><Bar dataKey="gmv" fill="#2f6f3e" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </section>
      </div>

      <section className="ui-card">
        <h3 className="ui-card-title">Across the platform</h3>
        <ul className="p4-chips">
          {Object.entries(users.byRole).map(([r, n]) => <li key={r}><strong>{ROLE_LABEL[r] || r}</strong> {n}</li>)}
          <li><strong>Produce listings</strong> {m.activeProduce}</li>
          <li><strong>Residue lots</strong> {m.activeResidue}</li>
          <li><strong>Open village pools</strong> {m.openPools}</li>
          <li><strong>Machines listed</strong> {m.machinesListed}</li>
          {Object.entries(logistics.trips).map(([s, n]) => <li key={s}><strong>Trips {s.toLowerCase().replace('_', ' ')}</strong> {n}</li>)}
          {Object.entries(fleet.vehicles).map(([s, n]) => <li key={s}><strong>Vehicles {s.toLowerCase().replace('_', ' ')}</strong> {n}</li>)}
        </ul>
      </section>
    </div>
  );
};

const Centres = () => {
  const { data, error, loading, reload } = useApi(() => api('/admin/centres'), [], { pollMs: 30000 });
  const fpos = useApi(() => api('/admin/fpos'), []);
  if (loading && !data) return <LoadingState text="Loading centres…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  return (
    <div className="p4-stack">
      <div className="p4-grid">
        {data.map((c) => (
          <article key={c.id} className="ui-card p4-card">
            <h3>{c.name} <small>({c.code})</small></h3>
            <p className="proc-hint">{c.district}, {c.state} · {c.counters} counters · capacity {c.dailyCapacity}/day</p>
            <div className="adm-meter" aria-label={`Booked on average ${c.utilizationPercent14}% of capacity`}><span style={{ width: `${Math.min(100, c.utilizationPercent14 || 0)}%` }} className={c.utilizationPercent14 > 90 ? 'hot' : ''} /></div>
            <p className="proc-hint">{c.utilizationPercent14}% of daily capacity booked on average (14 days, {c.avgBookedPerDay14}/day) · {c.completionRatePercent14}% completed</p>
            <p>Today: <strong>{c.today.booked}</strong> booked, <strong>{c.today.waiting}</strong> waiting{c.avgProcessingMinutes ? ` · ${c.avgProcessingMinutes} min per farmer` : ''}</p>
            <p className={c.unpaid.count ? 'p4-warn' : 'proc-hint'}>
              {c.unpaid.count ? `${c.unpaid.count} unpaid (${inr(c.unpaid.amount)})${c.unpaid.failed ? `, ${c.unpaid.failed} failed` : ''}, oldest ${c.unpaid.oldestHours} h` : 'No unpaid farmers'}
            </p>
            <p className="proc-hint">Managers: {c.managers.length ? c.managers.map((m) => m.name).join(', ') : 'none assigned'}</p>
          </article>
        ))}
      </div>
      <section className="ui-card">
        <h2 className="ui-card-title">Farmer producer organisations</h2>
        <ul className="p4-list">
          {fpos.data?.map((f) => (
            <li key={f.id} className="p4-row"><div><strong>{f.name}</strong><p className="proc-hint">{f.registrationNumber} · {f.location} · {f.contactPerson}</p></div><div>{f.members} members{f.unpaidToMembers ? <span className="p4-warn"> · {inr(f.unpaidToMembers)} unpaid to members</span> : ''}</div></li>
          ))}
        </ul>
      </section>
    </div>
  );
};

const People = () => {
  const toast = useToast();
  const [busy, run] = useAction();
  const [f, setF] = useState({ search: '', role: '', suspended: '', page: 1 });
  const [text, setText] = useState('');
  const [staff, setStaff] = useState(false);
  const [created, setCreated] = useState(null);
  const { data, error, loading, reload } = useApi(() => api(`/admin/users${qs(f)}`), [f.search, f.role, f.suspended, f.page]);
  const centres = useApi(() => api('/admin/centres'), []);

  const suspend = (u) => {
    const reason = u.suspended ? '' : window.prompt(`Why suspend ${u.name}? This is saved in the audit log.`);
    if (!u.suspended && !reason) return;
    run(async () => {
      try {
        await api(`/admin/users/${u.id}/suspend`, { method: 'POST', body: { suspended: !u.suspended, reason } });
        toast.success(u.suspended ? 'Account restored.' : 'Account suspended.');
        reload({ quiet: true });
      } catch (err) { toast.error(err.message); }
    });
  };
  const assign = (u, centerId) => run(async () => {
    const ids = u.centerIds.includes(centerId) ? u.centerIds.filter((c) => c !== centerId) : [...u.centerIds, centerId];
    try {
      await api(`/admin/users/${u.id}/centres`, { method: 'PUT', body: { centerIds: ids } });
      reload({ quiet: true });
    } catch (err) { toast.error(err.message); }
  });

  return (
    <div className="p4-stack">
      <form className="adm-filters" onSubmit={(e) => { e.preventDefault(); setF((x) => ({ ...x, search: text.trim(), page: 1 })); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Name, email, phone or farmer code" aria-label="Search people" />
        <select value={f.role} onChange={(e) => setF((x) => ({ ...x, role: e.target.value, page: 1 }))} aria-label="Role">
          <option value="">All roles</option>
          {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <label className="adm-check"><input type="checkbox" checked={f.suspended === 'true'} onChange={(e) => setF((x) => ({ ...x, suspended: e.target.checked ? 'true' : '', page: 1 }))} /> Suspended only</label>
        <button type="submit" className="ui-btn ui-btn-outline ui-btn-sm">Search</button>
        <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setStaff((s) => !s)}><UserPlus size={14} /> Add staff</button>
      </form>

      {staff && <StaffForm onDone={(r) => { setCreated(r); setStaff(false); reload({ quiet: true }); }} />}
      {created && (
        <div className="ui-card adm-created" role="status">
          <strong>{created.user.name} was added as {ROLE_LABEL[created.user.role]}.</strong>
          <p>Temporary password: <code>{created.temporaryPassword}</code></p>
          <p className="proc-hint">{created.note} Closing this hides it for good.</p>
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setCreated(null)}>Close</button>
        </div>
      )}

      {loading && !data && <LoadingState text="Loading people…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && data.users.length === 0 && <EmptyState icon={Users} title="Nobody matches" text="Try a different search." />}
      <ul className="p4-list">
        {data?.users.map((u) => (
          <li key={u.id} className="ui-card adm-user">
            <div className="p4-row">
              <div>
                <strong>{u.name}</strong> <StatusBadge status={u.suspended ? 'FAILED' : 'OPEN'} label={u.suspended ? 'suspended' : ROLE_LABEL[u.role]} />
                <p className="proc-hint">{u.email} · {u.phone || 'no phone'} · {u.location || 'no location'}{u.farmerCode ? ` · ${u.farmerCode}` : ''} · joined {fmtDateTime(u.createdAt)}</p>
              </div>
              {u.role !== 'ADMIN' && <button type="button" className={`ui-btn ${u.suspended ? 'ui-btn-outline' : 'ui-btn-ghost'} ui-btn-sm`} disabled={busy} onClick={() => suspend(u)}>{u.suspended ? 'Restore' : 'Suspend'}</button>}
            </div>
            {u.role === 'PROCUREMENT_MANAGER' && centres.data && (
              <div className="adm-centres">
                <span className="proc-hint">Runs these centres:</span>
                {centres.data.map((c) => (
                  <label key={c.id} className="adm-check"><input type="checkbox" checked={u.centerIds.includes(c.id)} disabled={busy} onChange={() => assign(u, c.id)} /> {c.code}</label>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {data && data.pages > 1 && (
        <div className="adm-pager">
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" disabled={f.page <= 1} onClick={() => setF((x) => ({ ...x, page: x.page - 1 }))}>Previous</button>
          <span>Page {data.page} of {data.pages} · {data.total} people</span>
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" disabled={f.page >= data.pages} onClick={() => setF((x) => ({ ...x, page: x.page + 1 }))}>Next</button>
        </div>
      )}
    </div>
  );
};

const StaffForm = ({ onDone }) => {
  const toast = useToast();
  const [busy, run] = useAction();
  const [f, setF] = useState({ name: '', email: '', phone: '', role: 'PROCUREMENT_MANAGER' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      try { onDone(await api('/admin/staff', { method: 'POST', body: f })); } catch (err) { toast.error(err.message); }
    });
  };
  return (
    <form className="ui-card ui-form-grid" onSubmit={submit} noValidate>
      <label className="ui-field"><span>Name</span><input value={f.name} onChange={set('name')} /></label>
      <label className="ui-field"><span>Email</span><input type="email" value={f.email} onChange={set('email')} /></label>
      <label className="ui-field"><span>Mobile number</span><input type="tel" value={f.phone} onChange={set('phone')} /></label>
      <label className="ui-field"><span>Role</span>
        <select value={f.role} onChange={set('role')}><option value="PROCUREMENT_MANAGER">Procurement manager</option><option value="LOGISTICS_OPERATOR">Logistics operator</option><option value="ADMIN">Admin</option></select>
      </label>
      <p className="proc-hint ui-span-2">A temporary password is created and shown once. Managers must then be assigned a centre below.</p>
      <div className="ui-span-2"><button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>Create account</button></div>
    </form>
  );
};

const Audit = () => {
  const { data, error, loading, reload } = useApi(() => api('/admin/audit'), [], { pollMs: 30000 });
  if (loading && !data) return <LoadingState text="Loading the audit log…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data.length) return <EmptyState icon={ScrollText} title="Nothing recorded yet" text="Account suspensions, new staff and centre assignments are listed here." />;
  return (
    <ul className="p4-list">
      {data.map((r) => (
        <li key={r.id} className="ui-card p4-row">
          <div><strong>{r.action.replace(/_/g, ' ').toLowerCase()}</strong> · {r.target}<p className="proc-hint">{r.actor} · {fmtDateTime(r.at)}{r.details?.reason ? ` · reason: ${r.details.reason}` : ''}{r.details?.role ? ` · ${r.details.role}` : ''}</p></div>
        </li>
      ))}
    </ul>
  );
};
