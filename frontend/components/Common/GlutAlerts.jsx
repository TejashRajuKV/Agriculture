import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../../utils/apiClient.js';
import { useApi } from '../../utils/hooks.js';
import { fmtDate, qty } from '../../utils/format.js';

// Warns when many farmers have booked the same crop at the same centre on the same day.
// It is about crowding and waiting, not prices, and says which data it uses.
export const GlutAlerts = () => {
  const { data } = useApi(() => api('/alerts/glut'), [], { pollMs: 60000, cacheKey: 'glut' });
  if (!data?.alerts?.length) return null;
  return (
    <section className="p4-glut" aria-label="Heavy arrival alerts">
      <h2 className="p4-glut-title"><AlertTriangle size={18} /> Heavy arrivals expected</h2>
      <ul>
        {data.alerts.slice(0, 4).map((a) => (
          <li key={`${a.centerId}-${a.cropId}-${a.date}`} className={a.severity === 'HIGH' ? 'high' : ''}>
            <strong>{a.crop} at {a.centerName}, {fmtDate(a.date)}:</strong> {qty(a.bookedKg)} booked, about {a.ratio}× the usual {qty(a.usualDailyKg)} a day. Expect long waits.
            {(a.lighterDays.length > 0 || a.otherCentres.length > 0) && (
              <span className="p4-glut-tip">
                {' '}Quieter: {[...a.lighterDays.map((d) => fmtDate(d)), ...a.otherCentres.map((c) => `${c.name} that day`)].join(', ')}.
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="proc-hint">Based on {data.basis.toLowerCase()}, compared with {data.usualBasis}.</p>
    </section>
  );
};
