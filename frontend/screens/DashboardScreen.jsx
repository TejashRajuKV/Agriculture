import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Leaf, Coins, Warehouse, Ticket, Store, Package, Bell, Truck, TrendingUp, ChevronRight } from 'lucide-react';
import { api } from '../utils/apiClient.js';
import { useApi } from '../utils/hooks.js';
import { fmtDate, inr, minutesLabel, qty, timeAgo } from '../utils/format.js';
import { StatusBadge, LoadingState, ErrorState } from '../components/Common/UI.jsx';
import './DashboardScreen.css';

// Every number here comes from GET /api/dashboard (the database), refreshed every 20 s
export const DashboardScreen = ({ user, onNavigate, onScanRequest }) => {
  const { data, error, loading, reload } = useApi(() => api('/dashboard'), [], { pollMs: 20000 });
  const isFarmer = ['FARMER', 'FPO'].includes(user.role);

  if (loading && !data) return <div className="dashboard-container"><LoadingState text="Loading your dashboard…" /></div>;
  if (error && !data) return <div className="dashboard-container"><ErrorState error={error} onRetry={reload} /></div>;

  const me = data.user;
  const roleLine =
    me.role === 'FARMER' ? `Farmer${me.farmerCode ? ` · ${me.farmerCode}` : ''}` : me.role === 'FPO' ? 'Farmer Producer Organisation' : me.buyerType && me.buyerType !== 'INDIVIDUAL' ? `Buyer · ${me.buyerType.toLowerCase()}` : 'Buyer';

  return (
    <div className="dashboard-container">
      <div className="dashboard-grid">
        {/* Hero */}
        <div className={`welcome-card ${isFarmer ? 'welcome-card-farmer' : 'welcome-card-buyer'}`}>
          <div className="welcome-content">
            <h1 className="welcome-title">Welcome back,<br />{me.name}</h1>
            <p className="welcome-subtitle">{roleLine}{me.location ? ` · ${me.location}` : ''}</p>
          </div>
          <div className="stats-container">
            <div className="stat-card">
              <div className="stat-header"><Leaf size={18} /><span>Carbon points</span></div>
              <p className="stat-value">{me.carbonPoints.toLocaleString('en-IN')} <span className="stat-unit">pts</span></p>
            </div>
            <div className="stat-card">
              <div className="stat-header"><Coins size={18} /><span>Wallet (demo money)</span></div>
              <p className="stat-value">{inr(me.walletBalance)}</p>
            </div>
          </div>
        </div>

        {isFarmer ? <FarmerPanels data={data} onNavigate={onNavigate} onScanRequest={onScanRequest} /> : <BuyerPanels data={data} onNavigate={onNavigate} />}

        <TrendChart data={data} isFarmer={isFarmer} />
        <NotificationsPanel items={data.notifications.items} unread={data.notifications.unread} onNavigate={onNavigate} />
        {isFarmer && <RewardsPreview points={me.carbonPoints} />}
      </div>
    </div>
  );
};

// Carbon-point rewards are not live yet - shown honestly as a preview
const RewardsPreview = ({ points }) => (
  <div className="bento-item bento-rewards">
    <h2 className="section-title">Rewards <span className="dash-soon">Coming soon</span></h2>
    <p className="section-subtitle">You have {points.toLocaleString('en-IN')} carbon points from selling residue instead of burning it. Redeeming them for inputs is on the way.</p>
    <div className="rewards-grid">
      {[
        { title: 'Seeds discount', color: 'reward-green' },
        { title: 'Tool rental', color: 'reward-orange' },
        { title: 'Fertilizer', color: 'reward-blue' }
      ].map((r) => (
        <div key={r.title} className="reward-card reward-card-soon" aria-disabled="true">
          <div className={`reward-icon ${r.color}`}><Leaf size={22} /></div>
          <div className="reward-info">
            <span className="reward-title">{r.title}</span>
            <span className="reward-subtitle">Not available yet</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const PanelHead = ({ icon: Icon, title, action, onAction }) => (
  <div className="activity-header">
    <h2 className="section-title dash-title"><Icon size={20} /> {title}</h2>
    {action && <button className="activity-view-all" onClick={onAction}>{action}</button>}
  </div>
);

const FarmerPanels = ({ data, onNavigate, onScanRequest }) => {
  const { procurement: p, marketplace: m } = data;
  const q = p.currentQueue;
  const next = p.upcoming[0];

  return (
    <>
      <div className="bento-item dash-half">
        <PanelHead icon={Warehouse} title="My procurement" action="Open" onAction={() => onNavigate('procurement')} />
        {q ? (
          <button type="button" className="dash-queue" onClick={() => onNavigate('procurement', { bookingId: q.bookingId })}>
            <span className="dash-queue-token">{q.token}</span>
            <span className="dash-queue-body">
              <strong>{q.status === 'CALLED' ? 'Your token is called – go to the counter' : q.status === 'PROCESSING' ? 'Your lot is being processed' : `${q.peopleAhead} ahead · about ${minutesLabel(q.estimatedWaitMinutes)}`}</strong>
              <span>{q.center} · now serving {q.nowServing || '—'}</span>
            </span>
            <ChevronRight size={18} />
          </button>
        ) : next ? (
          <button type="button" className="dash-queue dash-queue-upcoming" onClick={() => onNavigate('procurement', { bookingId: next.id })}>
            <span className="dash-queue-token">{next.token}</span>
            <span className="dash-queue-body">
              <strong>Next: {fmtDate(next.date)} at {next.slot.start}</strong>
              <span>{next.center.name} · {next.crop.name} {qty(next.estimatedQuantity)}</span>
            </span>
            <ChevronRight size={18} />
          </button>
        ) : (
          <div className="dash-empty">
            <p>No upcoming bookings.</p>
            <button className="activity-empty-cta" onClick={() => onNavigate('procurement')}>Book a slot</button>
          </div>
        )}
        <div className="dash-tiles">
          <div><span>Paid to you</span><strong>{inr(p.payments.paidAmount)}</strong><small>{p.payments.paidCount} payment{p.payments.paidCount === 1 ? '' : 's'}</small></div>
          <div className={p.payments.pendingCount ? 'dash-tile-warn' : ''}><span>Payment pending</span><strong>{inr(p.payments.pendingAmount)}</strong><small>{p.payments.pendingCount} in progress{p.payments.failedCount ? ` · ${p.payments.failedCount} failed` : ''}</small></div>
        </div>
        {p.history.length > 0 && (
          <ul className="dash-list">
            {p.history.slice(0, 3).map((h) => (
              <li key={h.recordNumber}>
                <button type="button" onClick={() => onNavigate('procurement', { bookingId: h.bookingId })}>
                  <span><strong>{h.crop} · {qty(h.acceptedQuantity)}</strong><small>{h.center} · {fmtDate(h.date)} · grade {h.qualityGrade}</small></span>
                  <span className="dash-amount">{inr(h.totalAmount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bento-item dash-half">
        <PanelHead icon={Store} title="My marketplace" action="Orders" onAction={() => onNavigate('orders')} />
        <div className="dash-tiles dash-tiles-3">
          <div><span>Active listings</span><strong>{m.activeListings}</strong></div>
          <div className={m.newOrders ? 'dash-tile-warn' : ''}><span>New orders</span><strong>{m.newOrders}</strong><small>{m.openOrders} open</small></div>
          <div><span>Revenue</span><strong>{inr(m.revenue)}</strong><small>delivered sales</small></div>
        </div>
        {m.inventory.length > 0 ? (
          <ul className="dash-list">
            {m.inventory.slice(0, 3).map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => onNavigate('marketplace')}>
                  <span><strong>{l.title}</strong><small>{inr(l.pricePerUnit)}/{l.unit}</small></span>
                  <span className="dash-amount">{qty(l.quantityAvailable, l.unit)} <small>of {qty(l.quantityListed, l.unit)}</small></span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="dash-empty">
            <p>Sell your harvest directly to buyers.</p>
            <button className="activity-empty-cta" onClick={() => onNavigate('marketplace')}>List produce</button>
          </div>
        )}
        <button type="button" className="dash-link" onClick={onScanRequest}>
          <Leaf size={14} /> Have crop residue? Scan it and sell instead of burning{m.residueListings ? ` (${m.residueListings} lot${m.residueListings > 1 ? 's' : ''} listed)` : ''}
        </button>
      </div>
    </>
  );
};

const BuyerPanels = ({ data, onNavigate }) => {
  const o = data.orders;
  return (
    <>
      <div className="bento-item dash-half">
        <PanelHead icon={Package} title="My orders" action="All orders" onAction={() => onNavigate('orders')} />
        <div className="dash-tiles dash-tiles-3">
          <div className={o.pending ? 'dash-tile-warn' : ''}><span>Awaiting seller</span><strong>{o.pending}</strong></div>
          <div><span>In progress</span><strong>{o.active}</strong></div>
          <div><span>Delivered</span><strong>{o.delivered}</strong><small>{inr(o.spent)} spent</small></div>
        </div>
        {o.recent.length ? (
          <ul className="dash-list">
            {o.recent.slice(0, 4).map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onNavigate('orders', { orderId: r.id })}>
                  <span><strong>{r.item.title} · {qty(r.quantity, r.item.unit)}</strong><small>{r.orderNumber} · {r.seller.name}</small></span>
                  <StatusBadge status={r.status} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="dash-empty">
            <p>No orders yet.</p>
            <button className="activity-empty-cta" onClick={() => onNavigate('marketplace')}>Browse produce</button>
          </div>
        )}
      </div>
      <div className="bento-item dash-half">
        <PanelHead icon={Truck} title="On the way" />
        {o.inDelivery.length ? (
          <ul className="dash-list">
            {o.inDelivery.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onNavigate('orders', { orderId: r.id })}>
                  <span><strong>{r.item.title} · {qty(r.quantity, r.item.unit)}</strong><small>from {r.item.pickupLocation} · {r.seller.name}</small></span>
                  <StatusBadge status={r.status} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="dash-empty"><p>Nothing in transit right now.</p></div>
        )}
        <div className="dash-tiles">
          <div><span>Residue bids open</span><strong>{data.residueBids.open}</strong></div>
          <div><span>Residue lots won</span><strong>{data.residueBids.won}</strong></div>
        </div>
      </div>
    </>
  );
};

const TrendChart = ({ data, isFarmer }) => {
  const series = isFarmer
    ? [{ key: 'procurement', name: 'Procurement', color: '#059669' }, { key: 'marketplace', name: 'Marketplace sales', color: '#f59e0b' }]
    : [{ key: 'spent', name: 'Spent on produce', color: '#2563eb' }];
  const total = data.trend.reduce((s, p) => s + series.reduce((t, x) => t + (p[x.key] || 0), 0), 0);
  return (
    <div className="bento-item bento-chart">
      <div className="chart-header">
        <div>
          <h2 className="section-title">{isFarmer ? 'Your earnings' : 'Your purchases'}</h2>
          <p className="section-subtitle">Last 6 months · {inr(total)} total</p>
        </div>
        <div className="chart-icon"><TrendingUp size={24} /></div>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.trend} margin={{ left: 0, right: 8 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', dy: 10 }} />
            <YAxis axisLine={false} tickLine={false} width={64} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => (v >= 100000 ? `₹${Math.round(v / 1000)}k` : inr(v))} />
            <Tooltip formatter={(v, name) => [inr(v), name]} contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={3} fill={`url(#grad-${s.key})`} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const NotificationsPanel = ({ items, unread, onNavigate }) => (
  <div className="bento-item bento-activity">
    <PanelHead icon={Bell} title={`Alerts${unread ? ` (${unread} new)` : ''}`} />
    {items.length === 0 ? (
      <div className="dash-empty"><p>No alerts yet. Booking, queue, payment and order updates appear here.</p></div>
    ) : (
      <ul className="dash-list dash-alerts">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() =>
                n.referenceType === 'booking'
                  ? onNavigate('procurement', { bookingId: n.referenceId })
                  : n.referenceType === 'order'
                    ? onNavigate('orders', { orderId: n.referenceId })
                    : n.referenceType === 'listing'
                      ? onNavigate('marketplace')
                      : null
              }
            >
              <span className={n.isRead ? '' : 'dash-unread'}>
                <strong>{n.title}</strong>
                <small>{n.message}</small>
              </span>
              <small className="dash-when">{timeAgo(n.createdAt)}</small>
            </button>
          </li>
        ))}
      </ul>
    )}
    <p className="dash-foot"><Ticket size={12} /> Updates also arrive in the bell at the top.</p>
  </div>
);
