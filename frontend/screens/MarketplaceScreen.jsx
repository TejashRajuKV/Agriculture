import React, { useState } from 'react';
import { Search, Plus, Pencil, Trash2, MapPin, CalendarDays, Store, Users2 } from 'lucide-react';
import { api, qs } from '../utils/apiClient.js';
import { useApi, useAction } from '../utils/hooks.js';
import { fmtDate, inr, qty } from '../utils/format.js';
import { StatusBadge, EmptyState, LoadingState, ErrorState } from '../components/Common/UI.jsx';
import { useToast } from '../components/Common/Toast.jsx';
import { ResidueMarket } from '../components/Marketplace/ResidueMarket.jsx';
import { ProduceListingForm } from '../components/Marketplace/ProduceListingForm.jsx';
import { PoolsMarket } from '../components/Marketplace/PoolsMarket.jsx';
import { OrderDialog } from '../components/Marketplace/OrderDialog.jsx';
import './ProcurementScreen.css';
import './MarketplaceScreen.css';

const CROP_EMOJI = { Tomato: '🍅', Onion: '🧅', Potato: '🥔', Paddy: '🌾', Wheat: '🌾', Maize: '🌽', Cotton: '☁️', Mustard: '🌼', Soyabean: '🫘', Groundnut: '🥜' };

// One marketplace, two kinds: fresh produce (fixed price + orders) and crop residue (bidding)
export const MarketplaceScreen = ({ user, onScanRequest, onOrdersRequest, initialKind = 'PRODUCE' }) => {
  const [kind, setKind] = useState(initialKind);
  return (
    <div className="marketplace-container">
      <div className="marketplace-header">
        <div>
          <h2 className="marketplace-title">Marketplace</h2>
          <p className="ui-page-sub">Buy directly from farmers and FPOs – no middlemen.</p>
        </div>
        <div className="ui-tabs" role="tablist" aria-label="Marketplace section">
          <button role="tab" aria-selected={kind === 'PRODUCE'} className={`ui-tab ${kind === 'PRODUCE' ? 'active' : ''}`} onClick={() => setKind('PRODUCE')}>
            Fresh produce
          </button>
          <button role="tab" aria-selected={kind === 'RESIDUE'} className={`ui-tab ${kind === 'RESIDUE' ? 'active' : ''}`} onClick={() => setKind('RESIDUE')}>
            Crop residue
          </button>
          <button role="tab" aria-selected={kind === 'POOLS'} className={`ui-tab ${kind === 'POOLS' ? 'active' : ''}`} onClick={() => setKind('POOLS')}>
            Village pools
          </button>
        </div>
      </div>
      {kind === 'PRODUCE' && <ProduceMarket user={user} onOrdersRequest={onOrdersRequest} />}
      {kind === 'RESIDUE' && <ResidueMarket user={user} onScanRequest={onScanRequest} />}
      {kind === 'POOLS' && <PoolsMarket user={user} />}
    </div>
  );
};

const ProduceMarket = ({ user, onOrdersRequest }) => {
  const toast = useToast();
  const isSeller = ['FARMER', 'FPO'].includes(user.role);
  const isBuyer = user.role === 'BUYER';
  const [filters, setFilters] = useState({ search: '', cropId: '', quality: '', sellerType: '', sort: 'newest', mine: false });
  const [searchText, setSearchText] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | listing
  const [viewing, setViewing] = useState(null);
  const [busy, run] = useAction();

  const { data: crops } = useApi(() => api('/crops'), []);
  const { data, error, loading, reload } = useApi(
    () =>
      api(
        `/marketplace/listings${qs({
          kind: 'PRODUCE',
          search: filters.search,
          cropId: filters.cropId,
          quality: filters.quality,
          sellerType: filters.sellerType,
          sort: filters.sort,
          mine: filters.mine ? 1 : undefined
        })}`
      ),
    [filters],
    { pollMs: 30000 }
  );
  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const remove = (l) =>
    window.confirm(`Remove "${l.title}" from the marketplace?`) &&
    run(async () => {
      try {
        const res = await api(`/marketplace/listings/${l.id}`, { method: 'DELETE' });
        toast.success(res.openOrders ? `Listing removed. ${res.openOrders} open order(s) still need fulfilling.` : 'Listing removed.');
        reload({ quiet: true });
      } catch (err) {
        toast.error(err.message);
      }
    });

  return (
    <>
      <div className="market-toolbar">
        <form
          className="proc-search market-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters((f) => ({ ...f, search: searchText.trim() }));
          }}
        >
          <Search size={18} aria-hidden="true" />
          <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search crop, seller or place" aria-label="Search produce" />
          <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm">Search</button>
        </form>
        {isSeller && (
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setEditing('new')} disabled={!crops}>
            <Plus size={16} /> List produce
          </button>
        )}
      </div>

      <div className="market-filters-row">
        <label className="ui-field">
          <span>Crop</span>
          <select value={filters.cropId} onChange={setFilter('cropId')}>
            <option value="">All crops</option>
            {crops?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="ui-field">
          <span>Quality</span>
          <select value={filters.quality} onChange={setFilter('quality')}>
            <option value="">Any</option>
            <option value="A">Grade A</option>
            <option value="B">Grade B</option>
            <option value="C">Grade C</option>
          </select>
        </label>
        <label className="ui-field">
          <span>Seller</span>
          <select value={filters.sellerType} onChange={setFilter('sellerType')}>
            <option value="">Farmers & FPOs</option>
            <option value="FARMER">Farmers</option>
            <option value="FPO">FPOs (bulk)</option>
          </select>
        </label>
        <label className="ui-field">
          <span>Sort</span>
          <select value={filters.sort} onChange={setFilter('sort')}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="harvest">Recently harvested</option>
            <option value="quantity">Most available</option>
          </select>
        </label>
        {isSeller && (
          <label className="market-mine">
            <input type="checkbox" checked={filters.mine} onChange={(e) => setFilters((f) => ({ ...f, mine: e.target.checked }))} /> Only my listings
          </label>
        )}
      </div>

      {loading && !data && <LoadingState text="Loading produce…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState
          icon={Store}
          title={filters.mine ? "You haven't listed anything yet" : 'No produce matches'}
          text={filters.mine ? 'List your harvest to sell directly to restaurants, retailers and processors.' : 'Try clearing the filters.'}
        />
      )}

      <div className="marketplace-grid">
        {data?.map((l) => {
          const soldPct = l.quantityListed ? Math.round(((l.quantityListed - l.quantityAvailable) / l.quantityListed) * 100) : 0;
          return (
            <article key={l.id} className="listing-card produce-card">
              <div className="listing-image-container produce-image">
                {l.image ? (
                  <img src={l.image} alt={l.title} className="listing-image" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <span className="produce-emoji" aria-hidden="true">{CROP_EMOJI[l.crop?.name] || '🧺'}</span>
                )}
                <span className="listing-status listing-status-open">{l.qualityGrade === 'UNGRADED' ? 'Not graded' : `Grade ${l.qualityGrade}`}</span>
                {l.isOwn ? <span className="listing-own-badge">Your listing</span> : l.seller.type === 'FPO' && <span className="listing-own-badge produce-fpo"><Users2 size={12} /> FPO</span>}
              </div>
              <div className="listing-content">
                <h3 className="listing-title">{l.title}</h3>
                <p className="listing-farmer">By {l.seller.name}</p>
                <p className="listing-location produce-meta">
                  <MapPin size={13} /> {l.location || '—'} · <CalendarDays size={13} /> {fmtDate(l.harvestDate)}
                </p>
                <div className="listing-footer">
                  <span className="listing-price">{inr(l.pricePerUnit, { decimals: l.pricePerUnit % 1 ? 2 : 0 })}/{l.unit}</span>
                  <span className="listing-quantity">{qty(l.quantityAvailable, l.unit)} left</span>
                </div>
                <div className="produce-stock" aria-label={`${soldPct}% sold`}>
                  <span style={{ width: `${soldPct}%` }} />
                </div>
                <p className="produce-min">Min. order {qty(l.minOrderQuantity, l.unit)}{l.status !== 'ACTIVE' && <> · <StatusBadge status={l.status} /></>}</p>

                <div className="listing-actions">
                  {l.isOwn ? (
                    <div className="deal-btn-row">
                      <button type="button" className="deal-btn deal-btn-outline" onClick={() => setEditing(l)}><Pencil size={14} /> Edit</button>
                      <button type="button" className="deal-btn deal-btn-ghost" disabled={busy} onClick={() => remove(l)}><Trash2 size={14} /> Remove</button>
                    </div>
                  ) : (
                    <div className="deal-btn-row">
                      <button type="button" className="deal-btn deal-btn-outline" onClick={() => setViewing(l.id)}>Details</button>
                      {isBuyer && (
                        <button type="button" className="deal-btn deal-btn-primary" disabled={l.status !== 'ACTIVE'} onClick={() => setViewing(l.id)}>
                          Order
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {editing && crops && (
        <ProduceListingForm
          crops={crops}
          listing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload({ quiet: true });
          }}
        />
      )}
      {viewing && (
        <OrderDialog
          listingId={viewing}
          canOrder={isBuyer}
          defaultAddress={user.location}
          onClose={() => setViewing(null)}
          onOrdered={() => {
            setViewing(null);
            reload({ quiet: true });
            onOrdersRequest?.();
          }}
        />
      )}
    </>
  );
};
