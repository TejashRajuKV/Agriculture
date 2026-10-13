import React, { useState } from 'react';
import { Flame, MapPin, Filter, Leaf, Trash2, Search, CheckCircle2 } from 'lucide-react';
import { api } from '../utils/apiClient.js';
import { useApi, useAction } from '../utils/hooks.js';
import { fmtDate } from '../utils/format.js';
import { LoadingState, ErrorState } from '../components/Common/UI.jsx';
import { useToast } from '../components/Common/Toast.jsx';
import './BiogasMarketplaceScreen.css';

// Biogas plants: claim open household pickups, then confirm collection
export const BiogasMarketplaceScreen = () => {
  const toast = useToast();
  const [filter, setFilter] = useState('DEGRADABLE');
  const [search, setSearch] = useState('');
  const [busy, run] = useAction();

  const { data, error, loading, reload } = useApi(() => api('/waste'), [], { pollMs: 15000 });
  const { data: dash, reload: reloadDash } = useApi(() => api('/dashboard'), []);

  const term = search.trim().toLowerCase();
  const matches = (r) => (filter === 'ALL' || r.degradability === filter) && (!term || r.address.toLowerCase().includes(term));
  const open = (data || []).filter((r) => r.stage === 'OPEN' && matches(r));
  const mine = (data || []).filter((r) => r.stage === 'CLAIMED' && r.claimedByMe);

  const act = (id, action, message) =>
    run(async () => {
      try {
        await api(`/waste/${id}/${action}`, { method: 'POST' });
        toast.success(message);
        reload({ quiet: true });
        reloadDash({ quiet: true });
      } catch (err) {
        toast.error(err.message);
        reload({ quiet: true });
      }
    });

  const w = dash?.waste;

  return (
    <div className="biogas-container">
      <div className="biogas-header">
        <div className="biogas-header-content">
          <div>
            <h1 className="biogas-title"><Flame size={32} className="biogas-title-icon" /> Biogas Procurement</h1>
            <p className="biogas-subtitle">Collect degradable household waste for energy generation.</p>
          </div>
          <div className="biogas-stats">
            <div className="biogas-stat"><p className="biogas-stat-label">Open pickups</p><p className="biogas-stat-value">{w ? w.openPickups : '—'}</p></div>
            <div className="biogas-stat biogas-stat-divider"><p className="biogas-stat-label">To collect</p><p className="biogas-stat-value">{w ? w.toCollect : '—'}</p></div>
            <div className="biogas-stat biogas-stat-divider"><p className="biogas-stat-label">Collected</p><p className="biogas-stat-value">{w ? `${w.collectedKg} kg` : '—'}</p></div>
          </div>
        </div>
      </div>

      {mine.length > 0 && (
        <section className="biogas-mine">
          <h2 className="biogas-section-title">Waiting for you to collect ({mine.length})</h2>
          <div className="listings-grid">
            {mine.map((r) => (
              <div key={r.id} className="listing-card">
                <div className="listing-content">
                  <h3 className="listing-farmer-name">{r.submittedBy} · {r.quantityKg} kg</h3>
                  <p className="listing-location"><MapPin size={14} /> {r.address}</p>
                  <p className="biogas-claimed-at">Accepted {fmtDate(r.claimedAt)}</p>
                  <button type="button" className="biogas-btn" disabled={busy} onClick={() => act(r.id, 'collected', 'Collection confirmed. The household has been told.')}>
                    <CheckCircle2 size={16} /> I collected it
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="filter-bar">
        <div className="filter-buttons">
          <button type="button" onClick={() => setFilter('DEGRADABLE')} className={`filter-button filter-button-degradable ${filter === 'DEGRADABLE' ? 'active' : ''}`}><Leaf size={16} /> Degradable</button>
          <button type="button" onClick={() => setFilter('NON_DEGRADABLE')} className={`filter-button filter-button-non-degradable ${filter === 'NON_DEGRADABLE' ? 'active' : ''}`}><Trash2 size={16} /> Non-degradable</button>
          <button type="button" onClick={() => setFilter('ALL')} className={`filter-button filter-button-all ${filter === 'ALL' ? 'active' : ''}`}>All</button>
        </div>
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input type="text" placeholder="Search by address or area…" className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search pickups by address" />
        </div>
      </div>

      {loading && !data && <LoadingState text="Loading pickups…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}

      <div className="listings-grid">
        {data && open.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon-container"><Filter className="empty-state-icon" size={32} /></div>
            <h3 className="empty-state-title">No open pickups</h3>
            <p className="empty-state-text">New household requests appear here.</p>
          </div>
        )}
        {open.map((r) => (
          <div key={r.id} className="listing-card">
            <div className="listing-image-container">
              {r.image ? <img src={r.image} className="listing-image" alt="waste" /> : <div className="biogas-noimage"><Leaf size={40} /></div>}
              <div className="listing-quantity-badge">{r.quantityKg} kg</div>
              <div className={`listing-type-badge ${r.degradability === 'DEGRADABLE' ? 'degradable' : 'non-degradable'}`}>
                {r.degradability === 'DEGRADABLE' ? <><Leaf size={12} /> Bio-degradable</> : <><Trash2 size={12} /> Non-degradable</>}
              </div>
            </div>
            <div className="listing-content">
              <h3 className="listing-farmer-name">{r.submittedBy}</h3>
              <p className="listing-location"><MapPin size={14} /> {r.address}</p>
              <p className="biogas-claimed-at">Requested {fmtDate(r.createdAt)}</p>
              {r.degradability === 'DEGRADABLE' ? (
                <button type="button" className="biogas-btn" disabled={busy} onClick={() => act(r.id, 'claim', 'Pickup accepted. It is now on your list.')}>
                  Accept pickup
                </button>
              ) : (
                <p className="biogas-claimed-at">Not suitable for biogas</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
