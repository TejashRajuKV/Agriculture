import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { api } from '../../utils/apiClient.js';
import { useI18n } from '../../utils/i18n.jsx';
import { SavedNote } from '../Common/OfflineBanner.jsx';
import { ReadAloud } from '../Common/Voice.jsx';
import { useApi } from '../../utils/hooks.js';
import { fmtDate, fmtDateTime, hoursLabel, inr, qty } from '../../utils/format.js';
import { StatusBadge, EmptyState, LoadingState, ErrorState } from '../Common/UI.jsx';

// Things that most often hold up a payment. Ticks are kept on this device only.
const CHECKLIST = [
  'Bank account number and IFSC match your passbook',
  'Your account is linked for direct benefit payments (Aadhaar-linked)',
  'Your name on the land record matches your ID',
  'You are registered as a farmer at the centre'
];

const loadChecks = () => {
  try { return JSON.parse(localStorage.getItem('agriloop.payChecklist') || '{}'); } catch { return {}; }
};

export const PaymentsTab = () => {
  const { t } = useI18n();
  const { data, error, loading, reload, savedAt } = useApi(() => api('/procurement/payments'), [], { pollMs: 30000, cacheKey: 'payments' });
  // Reasons are translated here; an unknown code falls back to the server's English text
  const delayText = (d, part) => {
    const k = `delay.${d.code}.${part}`;
    const out = t(k);
    return out === k ? (part === 'label' ? d.label : d.farmerAction) : out;
  };
  const [checks, setChecks] = useState(loadChecks);
  const toggle = (i) => {
    const next = { ...checks, [i]: !checks[i] };
    setChecks(next);
    try { localStorage.setItem('agriloop.payChecklist', JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  if (loading && !data) return <LoadingState text="Loading your payments…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="proc-bookings">
      <SavedNote savedAt={savedAt} />
      <section className="ui-card">
        <h2 className="ui-card-title">{t('pay.title')}</h2>
        {!data?.length ? (
          <EmptyState icon={Wallet} title={t('pay.empty')} text="A payment appears here once a centre finishes weighing and checking your lot." />
        ) : (
          <ul className="proc-pay-list">
            {data.map((p) => (
              <li key={p.id} className="proc-pay-item">
                <div className="proc-pay-top">
                  <strong>{p.crop} · {qty(p.quantityKg)} · {inr(p.amount)}</strong>
                  <StatusBadge status={p.status} label={t(`pay.${p.status.toLowerCase()}`)} />
                </div>
                <span className="proc-hint">{p.center} · {fmtDate(p.date)} · Record {p.recordNumber}</span>
                {p.status === 'PAID' && <span className="proc-hint">Paid {fmtDateTime(p.paidAt)} · ref {p.transactionRef}</span>}
                {p.delay && (
                  <div className="proc-pay-action" role="note">
                    <strong>{delayText(p.delay, 'label')}.</strong> {delayText(p.delay, 'action')}
                    {p.delay.note && <> ({p.delay.note})</>}
                  </div>
                )}
                {!p.delay && p.status === 'FAILED' && p.failureReason && <div className="proc-pay-action">{p.failureReason}. The centre will retry.</div>}
                {p.status !== 'PAID' && p.typicalPayout?.hours != null && (
                  <span className="proc-hint">{t('pay.typical', { time: hoursLabel(p.typicalPayout.hours) })}</span>
                )}
                {p.status !== 'PAID' && <ReadAloud text={`${p.crop} ${inr(p.amount)}. ${t(`pay.${p.status.toLowerCase()}`)}. ${p.delay ? delayText(p.delay, 'action') : ''}`} />}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="ui-card">
        <h2 className="ui-card-title">Before you go: avoid payment delays</h2>
        <p className="proc-hint">Delays are most often caused by record mismatches. Tick these off as you confirm them. This list stays on your phone only.</p>
        <ul className="proc-check">
          {CHECKLIST.map((c, i) => (
            <li key={c}><label><input type="checkbox" checked={!!checks[i]} onChange={() => toggle(i)} /> {c}</label></li>
          ))}
        </ul>
      </section>
    </div>
  );
};
