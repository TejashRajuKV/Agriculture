import React, { useState } from 'react';
import { Users, Wheat, IndianRupee, UserPlus, Trash2 } from 'lucide-react';
import { api } from '../utils/apiClient.js';
import { useApi, useAction } from '../utils/hooks.js';
import { inr, qty } from '../utils/format.js';
import { Stat, EmptyState, LoadingState, ErrorState } from '../components/Common/UI.jsx';
import { useToast } from '../components/Common/Toast.jsx';
import { GlutAlerts } from '../components/Common/GlutAlerts.jsx';
import './ProcurementScreen.css';
import './PhaseFour.css';

// The FPO's working view: who is bringing what this week and whose payment is stuck.
export const FpoScreen = () => {
  const toast = useToast();
  const [busy, run] = useAction();
  const [code, setCode] = useState('');
  const { data, error, loading, reload } = useApi(() => api('/fpo/overview'), [], { pollMs: 30000 });

  if (loading && !data) return <LoadingState text="Loading your FPO…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const { fpo, totals, members, supplyNext7Days } = data;

  const act = (fn, message) => run(async () => {
    try {
      await fn();
      toast.success(message);
      await reload({ quiet: true });
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  });

  const add = (e) => {
    e.preventDefault();
    const body = /^\d{10,12}$/.test(code.trim()) ? { phone: code.trim() } : { farmerCode: code.trim() };
    act(() => api('/fpo/members', { method: 'POST', body }), 'Member added.').then((ok) => ok && setCode(''));
  };

  return (
    <div className="proc-container">
      <div className="proc-header">
        <div>
          <h1 className="ui-page-title"><Users size={30} /> {fpo.name}</h1>
          <p className="ui-page-sub">{fpo.registrationNumber} · {fpo.location}</p>
        </div>
      </div>

      <div className="p4-stats">
        <Stat label="Members" value={totals.members} />
        <Stat label="Bringing in next 7 days" value={qty(totals.upcomingKg)} />
        <Stat label="Procured, last 30 days" value={qty(totals.procuredKg30d)} hint={inr(totals.earned30d)} />
        <Stat label="Waiting for payment" value={inr(totals.unpaidAmount)} hint={`${totals.membersWaitingForPayment} member${totals.membersWaitingForPayment === 1 ? '' : 's'}`} tone={totals.unpaidAmount ? 'warning' : undefined} />
      </div>

      <GlutAlerts />

      <section className="ui-card">
        <h2 className="ui-card-title"><Wheat size={20} /> Booked for the next 7 days</h2>
        {supplyNext7Days.length === 0 ? (
          <p className="proc-hint">No member has booked a slot yet.</p>
        ) : (
          <ul className="p4-chips">
            {supplyNext7Days.map((s) => <li key={s.crop}><strong>{s.crop}</strong> {qty(s.kg)} · {s.farmers} farmer{s.farmers === 1 ? '' : 's'}</li>)}
          </ul>
        )}
      </section>

      <section className="ui-card">
        <h2 className="ui-card-title"><IndianRupee size={20} /> Members</h2>
        <p className="proc-hint">Members with unpaid money are listed first, so you can follow up.</p>
        {members.length === 0 ? (
          <EmptyState icon={Users} title="No members yet" text="Add a farmer by farmer code or mobile number." />
        ) : (
          <div className="p4-table-wrap">
            <table className="p4-table">
              <thead>
                <tr><th>Farmer</th><th>Next 7+ days</th><th>Procured (30 d)</th><th>Unpaid</th><th>Listings</th><th /></tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Farmer"><strong>{m.name}</strong><br /><small>{m.farmerCode} · {m.phone || 'no phone'}</small></td>
                    <td data-label="Booked">{m.upcomingBookings ? `${m.upcomingBookings} · ${qty(m.upcomingKg)}` : '—'}</td>
                    <td data-label="Procured">{m.procuredKg30d ? `${qty(m.procuredKg30d)} · ${inr(m.earned30d)}` : '—'}</td>
                    <td data-label="Unpaid" className={m.unpaidAmount ? 'p4-warn' : ''}>{m.unpaidAmount ? `${inr(m.unpaidAmount)}${m.failedPayments ? ` (${m.failedPayments} failed)` : ''}` : '—'}</td>
                    <td data-label="Listings">{m.activeListings || '—'}</td>
                    <td>
                      <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" aria-label={`Remove ${m.name}`} disabled={busy}
                        onClick={() => window.confirm(`Remove ${m.name} from the FPO?`) && act(() => api(`/fpo/members/${m.id}`, { method: 'DELETE' }), 'Member removed.')}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form className="p4-inline" onSubmit={add}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Farmer code (FR-00012) or mobile number" aria-label="Farmer code or mobile number" />
          <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy || !code.trim()}><UserPlus size={14} /> Add member</button>
        </form>
      </section>
    </div>
  );
};
