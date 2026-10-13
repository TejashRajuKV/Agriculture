import React, { useState } from 'react';
import { Landmark, BellRing, ExternalLink, Trash2 } from 'lucide-react';
import { api } from '../utils/apiClient.js';
import { useApi, useAction } from '../utils/hooks.js';
import { fmtDate, todayIST } from '../utils/format.js';
import { LoadingState, ErrorState } from '../components/Common/UI.jsx';
import { useToast } from '../components/Common/Toast.jsx';
import './ProcurementScreen.css';
import './PhaseFour.css';

// Government schemes in plain words, with reminders the farmer sets for the dates that matter.
export const SchemesScreen = () => {
  const { data, error, loading, reload } = useApi(() => api('/schemes'), [], { cacheKey: 'schemes' });
  if (loading && !data) return <LoadingState text="Loading schemes…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  return (
    <div className="proc-container">
      <div className="proc-header">
        <div>
          <h1 className="ui-page-title"><Landmark size={30} /> Government schemes</h1>
          <p className="ui-page-sub">What each scheme gives, what you need, and a reminder so you do not miss the date. Dates change every season, so always confirm with the official site or your agriculture office.</p>
        </div>
      </div>
      <div className="p4-grid">
        {data.map((s) => <SchemeCard key={s.id} scheme={s} onChange={() => reload({ quiet: true })} />)}
      </div>
    </div>
  );
};

const SchemeCard = ({ scheme: s, onChange }) => {
  const toast = useToast();
  const [busy, run] = useAction();
  const [date, setDate] = useState(s.suggestedDates[0]?.date || '');
  const [note, setNote] = useState('');

  const add = (e) => {
    e.preventDefault();
    run(async () => {
      try {
        await api('/schemes/reminders', { method: 'POST', body: { schemeId: s.id, remindOn: date, note } });
        toast.success(`We will remind you on ${fmtDate(date)}.`);
        setNote('');
        onChange();
      } catch (err) {
        toast.error(err.message);
      }
    });
  };
  const remove = (id) => run(async () => {
    try {
      await api(`/schemes/reminders/${id}`, { method: 'DELETE' });
      onChange();
    } catch (err) {
      toast.error(err.message);
    }
  });

  return (
    <article className="ui-card p4-card">
      <h3>{s.name}</h3>
      <p>{s.summary}</p>
      {!s.applies && <p className="p4-warn">{s.notAvailableNote}</p>}
      <p className="proc-hint"><strong>You need:</strong> {s.needs.join(', ')}.</p>
      <p className="proc-hint">{s.tip}</p>
      {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="p4-link">Official site <ExternalLink size={13} /></a>}

      {s.reminders.length > 0 && (
        <ul className="p4-chips">
          {s.reminders.map((r) => (
            <li key={r.id}><BellRing size={12} /> {fmtDate(r.remindOn)}{r.note ? ` · ${r.note}` : ''}
              <button type="button" className="p4-x" aria-label="Delete reminder" onClick={() => remove(r.id)} disabled={busy}><Trash2 size={12} /></button>
            </li>
          ))}
        </ul>
      )}

      {s.applies && (
        <form className="p4-form" onSubmit={add}>
          {s.suggestedDates.length > 0 && (
            <p className="proc-hint">Typical dates (confirm yours): {s.suggestedDates.map((d) => (
              <button type="button" key={d.date} className="p4-pill" onClick={() => setDate(d.date)}>{d.label.replace(' (typical last date)', '')} {fmtDate(d.date)}</button>
            ))}</p>
          )}
          <label className="ui-field"><span>Remind me on</span><input type="date" min={todayIST()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="ui-field"><span>Note (optional)</span><input value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} /></label>
          <button type="submit" className="ui-btn ui-btn-outline ui-btn-sm" disabled={busy || !date}>Set reminder</button>
        </form>
      )}
    </article>
  );
};
