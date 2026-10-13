import React from 'react';
import { Info } from 'lucide-react';
import { api, qs } from '../../utils/apiClient.js';
import { useApi } from '../../utils/hooks.js';
import { inr } from '../../utils/format.js';

// A suggested price range with every input shown. It is a formula, and says so.
export const PriceGuidance = ({ cropId, grade, unit, onUse }) => {
  const { data } = useApi(() => api(`/intelligence/price-guidance${qs({ cropId, grade })}`), [cropId, grade]);
  if (!data?.available || unit !== 'kg') return null;
  return (
    <small className="market-ref price-guidance">
      <Info size={12} /> Suggested {inr(data.lowPerKg, { decimals: 2 })} to {inr(data.highPerKg, { decimals: 2 })} per kg for grade {data.grade}.{' '}
      <button type="button" className="p4-pill" onClick={() => onUse(String(data.suggestedPerKg))}>Use {inr(data.suggestedPerKg, { decimals: 2 })}</button>
      <details>
        <summary>How this is worked out</summary>
        <ul>
          {data.basis.map((b) => <li key={b.label}>{b.label}: {inr(b.perKg, { decimals: 2 })}/kg{b.asOf ? ` (${b.asOf})` : ''}</li>)}
        </ul>
        <span>{data.explanation} {data.staleWarning} {data.notML}</span>
      </details>
    </small>
  );
};
