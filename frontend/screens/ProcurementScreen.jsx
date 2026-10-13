import React, { useState } from 'react';
import { MapPin, Clock, Search, Users, Warehouse, Ticket, ChevronRight, ArrowLeft } from 'lucide-react';
import { api, qs } from '../utils/apiClient.js';
import { useApi } from '../utils/hooks.js';
import { fmtDate, hoursLabel, inr, minutesLabel, qty } from '../utils/format.js';
import { StatusBadge, EmptyState, LoadingState, ErrorState } from '../components/Common/UI.jsx';
import { BookSlotPanel } from '../components/Procurement/BookSlotPanel.jsx';
import { BookingDetail } from '../components/Procurement/BookingDetail.jsx';
import { PaymentsTab } from '../components/Procurement/PaymentsTab.jsx';
import { useI18n } from '../utils/i18n.jsx';
import { SavedNote } from '../components/Common/OfflineBanner.jsx';
import { GlutAlerts } from '../components/Common/GlutAlerts.jsx';
import { ReadAloud } from '../components/Common/Voice.jsx';
import './ProcurementScreen.css';

// Farmer-facing procurement: find a centre -> book a slot -> track queue, status and payment.
// `view` / `bookingId` can be set from outside (e.g. opening a notification).
export const ProcurementScreen = ({ user, initialBookingId, onBookingOpened }) => {
  const [view, setView] = useState(initialBookingId ? { name: 'detail', bookingId: initialBookingId } : { name: 'centres' });
  const [search, setSearch] = useState('');
  const { t } = useI18n();

  // A notification can deep-link here while the screen is already open
  React.useEffect(() => {
    if (initialBookingId) {
      setView({ name: 'detail', bookingId: initialBookingId });
      onBookingOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBookingId]);

  const tabs = (
    <div className="ui-tabs" role="tablist" aria-label="Procurement">
      <button role="tab" aria-selected={view.name === 'centres' || view.name === 'book'} className={`ui-tab ${['centres', 'book'].includes(view.name) ? 'active' : ''}`} onClick={() => setView({ name: 'centres' })}>
        {t('proc.tab.find')}
      </button>
      <button role="tab" aria-selected={view.name === 'bookings' || view.name === 'detail'} className={`ui-tab ${['bookings', 'detail'].includes(view.name) ? 'active' : ''}`} onClick={() => setView({ name: 'bookings' })}>
        {t('proc.tab.bookings')}
      </button>
      <button role="tab" aria-selected={view.name === 'payments'} className={`ui-tab ${view.name === 'payments' ? 'active' : ''}`} onClick={() => setView({ name: 'payments' })}>
        {t('proc.tab.payments')}
      </button>
    </div>
  );

  return (
    <div className="proc-container">
      <div className="proc-header">
        <div>
          <h1 className="ui-page-title"><Warehouse size={30} /> {t('proc.title')}</h1>
          <p className="ui-page-sub">{t('proc.sub')}</p>
          <ReadAloud text={t('proc.sub')} />
        </div>
        {tabs}
      </div>

      {['centres', 'book'].includes(view.name) && <GlutAlerts />}
      {view.name === 'centres' && <CentreList user={user} search={search} setSearch={setSearch} onBook={(centre) => setView({ name: 'book', centre })} />}
      {view.name === 'book' && (
        <BookSlotPanel
          centre={view.centre}
          onBack={() => setView({ name: 'centres' })}
          onTrack={(bookingId) => setView({ name: 'detail', bookingId })}
        />
      )}
      {view.name === 'payments' && <PaymentsTab />}
      {view.name === 'bookings' && <MyBookings onOpen={(bookingId) => setView({ name: 'detail', bookingId })} />}
      {view.name === 'detail' && (
        <>
          <button type="button" className="ui-btn ui-btn-ghost proc-back" onClick={() => setView({ name: 'bookings' })}>
            <ArrowLeft size={16} /> All bookings
          </button>
          <BookingDetail bookingId={view.bookingId} />
        </>
      )}
    </div>
  );
};

const CentreList = ({ user, search, setSearch, onBook }) => {
  const [query, setQuery] = useState(search);
  const { t } = useI18n();
  const { data, error, loading, reload, savedAt } = useApi(() => api(`/procurement-centers${qs({ search })}`), [search], { pollMs: 30000, cacheKey: `centres:${search}` });

  return (
    <>
      <form
        className="proc-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
        }}
      >
        <Search size={18} aria-hidden="true" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('proc.search')} aria-label="Search procurement centres" />
        <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm">Search</button>
      </form>
      <SavedNote savedAt={savedAt} />
      {!user.location && <p className="proc-hint">Add your village/town to your profile to see distances.</p>}

      {loading && !data && <LoadingState text="Finding procurement centres…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState icon={Warehouse} title="No centres found" text="Try a different district or clear the search." />}

      <div className="proc-centre-grid">
        {data?.map((c) => (
          <article key={c.id} className="proc-centre-card">
            <div className="proc-centre-top">
              <div>
                <h2 className="proc-centre-name">{c.name}</h2>
                <p className="proc-centre-meta">
                  <MapPin size={14} /> {c.district}, {c.state}
                  {c.distanceKm != null && <> · {c.distanceKm < 1 ? '< 1' : Math.round(c.distanceKm)} km away</>}
                </p>
              </div>
              <StatusBadge status={c.status === 'ACTIVE' ? 'OPEN' : 'CLOSED'} label={c.status === 'ACTIVE' ? 'Open' : 'Closed'} />
            </div>

            <dl className="proc-centre-stats">
              <div><dt><Clock size={14} /> Hours</dt><dd>{c.openingTime}–{c.closingTime}</dd></div>
              <div><dt><Users size={14} /> {t('proc.inQueue')}</dt><dd>{c.today.inQueue}{c.today.nowServing ? ` · serving ${c.today.nowServing.slice(-3)}` : ''}</dd></div>
              <div><dt>Today's capacity left</dt><dd>{c.today.remaining} of {c.today.dailyCapacity}</dd></div>
              <div><dt>{t('proc.wait')}</dt><dd>{minutesLabel(c.today.estimatedWaitMinutes)}</dd></div>
            </dl>

            {c.prices?.length ? (
              <ul className="proc-price-list" aria-label="Buying prices">
                {c.prices.map((p) => (
                  <li key={p.cropId}>
                    <strong>{p.crop}</strong> {inr(p.pricePerKg, { decimals: 2 })}/kg
                    {p.maxMoisturePct != null && <small> · moisture ≤ {p.maxMoisturePct}%</small>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="proc-centre-crops">Buys: {c.crops.map((cr) => cr.name).join(', ')}</p>
            )}
            {c.typicalPayout && (
              <p className="proc-hint">Payment here usually arrives in about {hoursLabel(c.typicalPayout.hours)} (from the last {c.typicalPayout.sample} paid lots).</p>
            )}

            <div className="proc-centre-foot">
              <span className="proc-next">
                {c.today.nextAvailableSlot ? <>Next slot today <strong>{c.today.nextAvailableSlot.startTime}</strong></> : 'No more slots today'}
              </span>
              <button type="button" className="ui-btn ui-btn-primary" disabled={c.status !== 'ACTIVE'} onClick={() => onBook(c)}>
                {t('proc.book')} <ChevronRight size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
};

const MyBookings = ({ onOpen }) => {
  const { data, error, loading, reload, savedAt } = useApi(() => api('/procurement/bookings'), [], { pollMs: 20000, cacheKey: 'bookings' });
  if (loading && !data) return <LoadingState text="Loading your bookings…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data?.length) return <EmptyState icon={Ticket} title="No bookings yet" text="Book a slot at a procurement centre to get a token and skip the queue." />;

  const upcoming = data.filter((b) => ['BOOKED', 'CONFIRMED'].includes(b.status));
  const past = data.filter((b) => !['BOOKED', 'CONFIRMED'].includes(b.status));
  const Row = ({ b }) => (
    <li>
      <button type="button" className="proc-booking-row" onClick={() => onOpen(b.id)}>
        <span className="proc-token">{b.token}</span>
        <span className="proc-booking-main">
          <strong>{b.crop.name} · {qty(b.estimatedQuantity)}</strong>
          <span>{b.center.name} · {fmtDate(b.date)} {b.slot.start}</span>
        </span>
        <span className="proc-booking-status">
          {b.payment ? <StatusBadge status={b.payment.status} label={`Payment: ${b.payment.status.toLowerCase()}`} /> : <StatusBadge status={b.status === 'COMPLETED' ? 'COMPLETED' : b.queueStatus} />}
          <ChevronRight size={16} aria-hidden="true" />
        </span>
      </button>
    </li>
  );

  return (
    <div className="proc-bookings">
      <SavedNote savedAt={savedAt} />
      <section className="ui-card">
        <h2 className="ui-card-title">Upcoming</h2>
        {upcoming.length ? <ul className="proc-booking-list">{upcoming.map((b) => <Row key={b.id} b={b} />)}</ul> : <p className="proc-hint">No upcoming bookings.</p>}
      </section>
      <section className="ui-card">
        <h2 className="ui-card-title">History</h2>
        {past.length ? <ul className="proc-booking-list">{past.map((b) => <Row key={b.id} b={b} />)}</ul> : <p className="proc-hint">Nothing here yet.</p>}
      </section>
    </div>
  );
};
