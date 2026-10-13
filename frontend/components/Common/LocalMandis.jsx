import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { api, qs } from '../../utils/apiClient.js';
import { inr, fmtDate } from '../../utils/format.js';

// Today's prices at mandis in your state, straight from the government open-data feed.
// Shows nothing invented: when the feed is off or has no rows, it says so.
export const LocalMandis = ({ crop, userLocation }) => {
  const guessState = String(userLocation || '').split(',').map((s) => s.trim()).filter(Boolean).at(-1) || '';
  const [state, setState] = useState(guessState);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      setResult(await api(`/mandi/prices${qs({ commodity: crop, state })}`));
    } catch (err) {
      setResult({ live: false, reason: 'ERROR', message: err.message, records: [] });
    } finally {
      setBusy(false);
    }
  };

  // Names differ between feeds ("Paddy(Common)" vs "Paddy(Dhan)(Common)"); the first word usually matches
  const commodity = crop;
  const rows = [...(result?.records || [])].sort((a, b) => b.modalPerQuintal - a.modalPerQuintal);

  return (
    <div className="local-mandis">
      <h4><MapPin size={16} /> Mandis near you</h4>
      <form onSubmit={load} className="local-mandis-form">
        <input value={state} onChange={(e) => setState(e.target.value)} placeholder="State, e.g. Karnataka" aria-label="State" />
        <button type="submit" className="ui-btn ui-btn-outline ui-btn-sm" disabled={busy}>{busy ? 'Loading…' : `Show ${commodity} prices`}</button>
      </form>
      {result && !result.live && (
        <p className="proc-hint">
          {result.reason === 'NO_KEY' ? result.message : 'Could not load live mandi prices right now. The table above still shows the bundled prices.'}
        </p>
      )}
      {result?.live && rows.length === 0 && <p className="proc-hint">No mandi in this state reported {commodity} recently. Try another spelling or state.</p>}
      {rows.length > 0 && (
        <>
          <p className="proc-hint">Prices on {fmtDate(result.latestDate)}, per quintal. Source: data.gov.in (AGMARKNET).</p>
          <ul className="local-mandis-list">
            {rows.slice(0, 12).map((r, i) => (
              <li key={`${r.market}-${i}`}>
                <span><strong>{r.market}</strong>, {r.district}</span>
                <span>{inr(r.modalPerQuintal)} <small>({inr(r.minPerQuintal)}–{inr(r.maxPerQuintal)})</small></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
