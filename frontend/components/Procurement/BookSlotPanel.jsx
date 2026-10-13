import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Ticket } from 'lucide-react';
import { api } from '../../utils/apiClient.js';
import { useApi, useAction } from '../../utils/hooks.js';
import { addDaysIso, fmtDate, inr, minutesLabel, todayIST } from '../../utils/format.js';
import { LoadingState, ErrorState, EmptyState } from '../Common/UI.jsx';
import { useToast } from '../Common/Toast.jsx';
import { useI18n } from '../../utils/i18n.jsx';
import { ArrivalsForecast } from '../Common/ArrivalsForecast.jsx';

// Chance of rain on the travel day at the centre, from Open-Meteo (no key). null when unavailable.
const useRain = (loc, date) => {
  const [rain, setRain] = useState(null);
  React.useEffect(() => {
    setRain(null);
    if (!loc?.lat || !loc?.lng) return undefined;
    let live = true;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&daily=precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=8`)
      .then((r) => r.json())
      .then((j) => {
        const i = j?.daily?.time?.indexOf(date);
        if (live && i >= 0) setRain(j.daily.precipitation_probability_max[i]);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [loc?.lat, loc?.lng, date]);
  return rain;
};

// Date -> slot -> crop + quantity -> confirm. The token is created by the server.
export const BookSlotPanel = ({ centre, onBack, onTrack }) => {
  const toast = useToast();
  const { t } = useI18n();
  const [date, setDate] = useState(todayIST());
  const [slotId, setSlotId] = useState(null);
  const [cropId, setCropId] = useState(centre.crops[0]?.id || '');
  const [quantity, setQuantity] = useState('');
  const [formError, setFormError] = useState('');
  const [confirmed, setConfirmed] = useState(null);
  const [busy, run] = useAction();

  const { data, error, loading, reload } = useApi(() => api(`/procurement-centers/${centre.id}/slots?date=${date}`), [date], { pollMs: 20000 });
  const dates = useMemo(() => Array.from({ length: data?.bookingWindowDays || 7 }, (_, i) => addDaysIso(todayIST(), i)), [data?.bookingWindowDays]);
  const slot = data?.slots.find((s) => s.id === slotId);
  const available = data?.slots.filter((s) => s.available) || [];
  const price = centre.prices?.find((p) => p.cropId === cropId);
  const rain = useRain(centre.location, date);

  const submit = (e) => {
    e.preventDefault();
    setFormError('');
    const q = Number(quantity);
    if (!slot) return setFormError('Pick a time slot.');
    if (!cropId) return setFormError('Pick a crop.');
    if (!Number.isFinite(q) || q <= 0) return setFormError('Enter the quantity you are bringing, in kg.');
    run(async () => {
      try {
        const booking = await api('/procurement/bookings', { method: 'POST', body: { slotId: slot.id, cropId, estimatedQuantity: q } });
        setConfirmed(booking);
        toast.success(`Slot booked. Your token is ${booking.token}.`);
      } catch (err) {
        setFormError(err.message);
        reload({ quiet: true }); // the slot may have just filled up
      }
    });
  };

  if (confirmed) {
    return (
      <section className="ui-card proc-confirm">
        <CheckCircle2 size={44} className="proc-confirm-icon" />
        <h2 className="ui-card-title">Slot booked</h2>
        <p className="proc-token-big" aria-label={`Token ${confirmed.token}`}>{confirmed.token}</p>
        <dl className="proc-confirm-list">
          <div><dt>Booking number</dt><dd>{confirmed.bookingNumber}</dd></div>
          <div><dt>Centre</dt><dd>{confirmed.center.name}</dd></div>
          <div><dt>When</dt><dd>{fmtDate(confirmed.date)}, {confirmed.slot.start}–{confirmed.slot.end}</dd></div>
          <div><dt>Crop</dt><dd>{confirmed.crop.name} · {confirmed.estimatedQuantity} kg</dd></div>
        </dl>
        <p className="proc-hint">
          On the day, press <strong>I've arrived</strong> when you reach the centre to join the queue. Show this token at the gate.
        </p>
        <div className="proc-confirm-actions">
          <button type="button" className="ui-btn ui-btn-primary ui-btn-lg" onClick={() => onTrack(confirmed.id)}>
            <Ticket size={18} /> Track this booking
          </button>
          <button type="button" className="ui-btn ui-btn-outline" onClick={onBack}>Back to centres</button>
        </div>
      </section>
    );
  }

  return (
    <div className="proc-book">
      <button type="button" className="ui-btn ui-btn-ghost proc-back" onClick={onBack}>
        <ArrowLeft size={16} /> All centres
      </button>
      <section className="ui-card">
        <h2 className="ui-card-title">{centre.name}</h2>
        <p className="proc-hint">
          Open {centre.openingTime}–{centre.closingTime}. {data && <>Average time per farmer: {data.averageProcessingMinutes} min ({data.averageBasis}), {data.counters} counter{data.counters > 1 ? 's' : ''}.</>}
        </p>

        <h3 className="proc-step">{t('proc.step1')}</h3>
        <div className="proc-dates" role="radiogroup" aria-label="Date">
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === date}
              className={`proc-date ${d === date ? 'active' : ''}`}
              onClick={() => {
                setDate(d);
                setSlotId(null);
              }}
            >
              {d === todayIST() ? 'Today' : fmtDate(d)}
            </button>
          ))}
        </div>

        {cropId && <details className="proc-forecast"><summary>Which days are busy? (expected arrivals)</summary><ArrivalsForecast centerId={centre.id} cropId={cropId} compact /></details>}
        <h3 className="proc-step">{t('proc.step2')}</h3>
        {loading && !data && <LoadingState text="Loading slots…" />}
        {error && !data && <ErrorState error={error} onRetry={reload} />}
        {data && available.length === 0 && (
          <EmptyState title="No free slots on this day" text={data.slots.length ? 'All slots are full or already over. Try another day.' : 'The centre is closed on this day.'} />
        )}
        {data && available.length > 0 && (
          <div className="proc-slots" role="radiogroup" aria-label="Time slot">
            {data.slots
              .filter((s) => !s.past)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={s.id === slotId}
                  disabled={!s.available}
                  className={`proc-slot ${s.id === slotId ? 'active' : ''}`}
                  onClick={() => setSlotId(s.id)}
                >
                  <strong>{s.startTime}</strong>
                  <span>{s.available ? `${s.remaining} of ${s.capacity} left` : 'Full'}</span>
                  {s.available && <small>~{minutesLabel(s.estimatedWaitMinutes)} wait</small>}
                </button>
              ))}
          </div>
        )}

        <h3 className="proc-step">{t('proc.step3')}</h3>
        <form className="ui-form-grid" onSubmit={submit} noValidate>
          <label className="ui-field">
            <span>{t('proc.crop')}</span>
            <select value={cropId} onChange={(e) => setCropId(e.target.value)}>
              {centre.crops.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="ui-field">
            <span>{t('proc.qty')}</span>
            <input type="number" min="1" step="10" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 500" />
          </label>
          {price && (
            <div className="proc-ready ui-span-2">
              <h4>{t('proc.travel')}</h4>
              <ul>
                <li>The centre pays <strong>{inr(price.pricePerKg, { decimals: 2 })}/kg</strong> for this crop{quantity > 0 && <> (about {inr(price.pricePerKg * Number(quantity))} for {quantity} kg, before any rejection)</>}.</li>
                {price.maxMoisturePct != null && <li>Moisture limit <strong>{price.maxMoisturePct}%</strong>. Lots above this may be rejected or cut. Confirm the limit with the centre if unsure.</li>}
                {slot && <li>Expected wait at this slot: about {minutesLabel(slot.estimatedWaitMinutes)}.</li>}
                {rain != null && rain >= 50 && <li className="warn">Rain is likely on {fmtDate(date)} ({rain}% chance). Cover your produce; wet grain can fail the moisture check.</li>}
                {rain != null && rain < 50 && <li>Rain chance on {fmtDate(date)}: {rain}%.</li>}
              </ul>
              <p className="proc-hint">A rule-based checklist, not a guarantee of acceptance.</p>
            </div>
          )}
          {formError && <p className="ui-field-error ui-span-2" role="alert">{formError}</p>}
          <div className="ui-span-2 proc-book-submit">
            <span className="proc-hint">{slot ? <>You picked <strong>{fmtDate(date)}, {slot.startTime}</strong></> : 'Pick a slot above.'}</span>
            <button type="submit" className="ui-btn ui-btn-primary ui-btn-lg" disabled={busy || !slot}>
              {busy ? '…' : t('proc.confirm')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
