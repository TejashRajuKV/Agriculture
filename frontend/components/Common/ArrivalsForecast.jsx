import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ErrorBar, Cell } from 'recharts';
import { api, qs } from '../../utils/apiClient.js';
import { useApi } from '../../utils/hooks.js';
import { fmtDate, qty } from '../../utils/format.js';

// Expected kg arriving per day at a centre for a crop, with a likely range, plus how far to trust it.
export const ArrivalsForecast = ({ centerId, cropId, compact = false }) => {
  const { data, loading } = useApi(() => api(`/intelligence/demand${qs({ centerId, cropId })}`), [centerId, cropId]);
  if (loading && !data) return <p className="proc-hint">Working out expected arrivals…</p>;
  if (!data) return null;
  if (!data.available) return <p className="proc-hint">{data.reason}</p>;

  const rows = data.days.map((d) => ({ ...d, label: fmtDate(d.date).split(',')[0] + ' ' + d.date.slice(8), err: [d.expectedKg - d.lowKg, d.highKg - d.expectedKg] }));
  const busiest = [...data.days].sort((a, b) => b.expectedKg - a.expectedKg)[0];
  const quietest = [...data.days].sort((a, b) => a.expectedKg - b.expectedKg)[0];

  return (
    <div className="arrivals">
      <p className="proc-hint">
        Expected arrivals of {data.crop.name} at {data.center.name}. Busiest {fmtDate(busiest.date)} (about {qty(busiest.expectedKg)}), quietest {fmtDate(quietest.date)} (about {qty(quietest.expectedKg)}).
      </p>
      <div style={{ width: '100%', height: compact ? 150 : 210 }}>
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={44} />
            <Tooltip formatter={(v, n, p) => [`${qty(p.payload.expectedKg)} (likely ${qty(p.payload.lowKg)} to ${qty(p.payload.highKg)})`, 'Expected']} />
            <Bar dataKey="expectedKg" radius={[4, 4, 0, 0]}>
              {rows.map((r) => <Cell key={r.date} fill={r.vsUsual >= 1.3 ? '#c9822b' : r.vsUsual <= 0.8 ? '#7fb98a' : '#3f8f4f'} />)}
              <ErrorBar dataKey="err" width={4} strokeWidth={1.5} stroke="#555" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="proc-hint">
        Past error: about {data.accuracy.modelErrorPercent}% (a simple rule, {data.accuracy.simpleRule}, was {data.accuracy.simpleRuleErrorPercent}%), tested on {data.accuracy.testedOn}. Orange = well above the usual {qty(data.usualDailyKg)} a day.
      </p>
      {data.dataBasis.warning && <p className="p4-warn">{data.dataBasis.warning}</p>}
    </div>
  );
};
