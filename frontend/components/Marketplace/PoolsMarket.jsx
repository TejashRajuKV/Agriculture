import React, { useState } from 'react';
import { Users2, Plus, CalendarClock } from 'lucide-react';
import { api } from '../../utils/apiClient.js';
import { useApi, useAction } from '../../utils/hooks.js';
import { fmtDate, inr, todayIST, addDaysIso } from '../../utils/format.js';
import { StatusBadge, EmptyState, LoadingState, ErrorState } from '../Common/UI.jsx';
import { useToast } from '../Common/Toast.jsx';
import './PoolsMarket.css';

const SELLER_ROLES = ['FARMER', 'FPO'];
const BUYER_ROLES = ['BUYER', 'BIOGAS'];

// Neighbours pool straw into one lot big enough for a baler or biogas plant to bother collecting.
export const PoolsMarket = ({ user }) => {
  const toast = useToast();
  const [busy, run] = useAction();
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useApi(() => api('/pools'), [], { pollMs: 20000 });

  const act = (path, options, message) =>
    run(async () => {
      try {
        await api(path, options);
        if (message) toast.success(message);
        await reload({ quiet: true });
        return true;
      } catch (err) {
        toast.error(err.message);
        return false;
      }
    });

  return (
    <div className="pools">
      <div className="pools-intro">
        <p className="ui-page-sub">
          One farmer's straw is too little for a baler to visit. Pool it with your village, set a minimum and a deadline, and buyers bid on the whole lot. Payment is split by each farmer's tonnes.
        </p>
        {SELLER_ROLES.includes(user.role) && (
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setCreating((c) => !c)}>
            <Plus size={16} /> Start a pool
          </button>
        )}
      </div>

      {creating && <CreatePool onDone={() => { setCreating(false); reload({ quiet: true }); }} busy={busy} user={user} />}

      {loading && !data && <LoadingState text="Loading village pools…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && !data.length && <EmptyState icon={Users2} title="No pools yet" text="Start one for your village and invite neighbours." />}

      <div className="pools-grid">
        {data?.map((p) => <PoolCard key={p.id} pool={p} user={user} busy={busy} act={act} />)}
      </div>
    </div>
  );
};

const CreatePool = ({ onDone, user }) => {
  const toast = useToast();
  const [busy, run] = useAction();
  const [f, setF] = useState({ name: '', residue: 'Paddy straw', village: '', minTonnes: '20', myTonnes: '', deadline: addDaysIso(todayIST(), 14) });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      try {
        await api('/pools', { method: 'POST', body: { ...f, minTonnes: Number(f.minTonnes), myTonnes: Number(f.myTonnes) } });
        toast.success('Pool started. Share it with your neighbours.');
        onDone();
      } catch (err) {
        toast.error(err.message);
      }
    });
  };
  return (
    <form className="ui-card ui-form-grid" onSubmit={submit} noValidate>
      <label className="ui-field"><span>Pool name</span><input value={f.name} onChange={set('name')} placeholder="e.g. Kikkeri paddy straw" /></label>
      <label className="ui-field"><span>Residue</span><input value={f.residue} onChange={set('residue')} /></label>
      <label className="ui-field"><span>Village</span><input value={f.village} onChange={set('village')} /></label>
      <label className="ui-field"><span>Minimum tonnes buyers need</span><input type="number" min="1" value={f.minTonnes} onChange={set('minTonnes')} /></label>
      <label className="ui-field"><span>Your tonnes</span><input type="number" min="0.1" step="0.1" value={f.myTonnes} onChange={set('myTonnes')} /></label>
      <label className="ui-field"><span>Last day to join</span><input type="date" min={todayIST()} value={f.deadline} onChange={set('deadline')} /></label>
      <p className="proc-hint ui-span-2">Location comes from your profile ({user.location || 'not set'}). Buyers can only bid once the minimum is reached.</p>
      <div className="ui-span-2"><button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>{busy ? 'Starting…' : 'Start pool'}</button></div>
    </form>
  );
};

const PoolCard = ({ pool: p, user, busy, act }) => {
  const [tonnes, setTonnes] = useState('');
  const [price, setPrice] = useState('');
  const [pickup, setPickup] = useState(addDaysIso(todayIST(), 10));
  const isSeller = SELLER_ROLES.includes(user.role);
  const isBuyer = BUYER_ROLES.includes(user.role);
  const open = p.status === 'OPEN';
  const joined = p.myTonnes != null;
  const acceptedBid = p.bids.find((b) => b.id === p.acceptedBid);

  return (
    <article className="ui-card pool-card">
      <div className="pool-top">
        <div>
          <h3 className="pool-name">{p.name}</h3>
          <p className="proc-hint">{p.residue} · {p.village ? `${p.village}, ` : ''}{p.district}, {p.state}</p>
        </div>
        <StatusBadge status={p.status} />
      </div>

      <div className="pool-bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.minTonnes} aria-valuenow={p.totalTonnes} aria-label="Tonnes pooled">
        <span style={{ width: `${p.progressPercent}%` }} className={p.reachedMinimum ? 'done' : ''} />
      </div>
      <p className="pool-numbers">
        <strong>{p.totalTonnes} t</strong> of {p.minTonnes} t needed · {p.memberCount} farmer{p.memberCount === 1 ? '' : 's'}
        {!p.reachedMinimum && open && <> · <span className="pool-need">{Math.round((p.minTonnes - p.totalTonnes) * 10) / 10} t to go</span></>}
      </p>
      {open && (
        <p className="pool-deadline"><CalendarClock size={14} /> {p.deadlinePassed ? 'Deadline passed' : p.daysLeft === 0 ? 'Last day to join' : `${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'} left to join`} · {fmtDate(p.deadline)}</p>
      )}
      <p className="proc-hint">Coordinator: {p.coordinator.name}{joined && <> · You: <strong>{p.myTonnes} t</strong></>}</p>

      {p.members && (
        <details className="pool-members">
          <summary>Members</summary>
          <ul>{p.members.map((m) => <li key={m.id}>{m.name} · {m.tonnes} t</li>)}</ul>
        </details>
      )}

      {acceptedBid && <p className="pool-accepted">Sold at <strong>{inr(acceptedBid.pricePerTon)}/t</strong> to {acceptedBid.buyerName}. Pickup {fmtDate(acceptedBid.pickupDate)}.</p>}

      {/* Farmer actions */}
      {isSeller && open && !joined && !p.deadlinePassed && (
        <form className="pool-inline" onSubmit={(e) => { e.preventDefault(); act(`/pools/${p.id}/join`, { method: 'POST', body: { tonnes: Number(tonnes) } }, 'You joined the pool.'); }}>
          <input type="number" min="0.1" step="0.1" value={tonnes} onChange={(e) => setTonnes(e.target.value)} placeholder="Your tonnes" aria-label="Your tonnes" />
          <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy || !tonnes}>Join</button>
        </form>
      )}
      {isSeller && open && joined && !p.isCoordinator && (
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" disabled={busy} onClick={() => act(`/pools/${p.id}/leave`, { method: 'POST' }, 'You left the pool.')}>Leave pool</button>
      )}

      {/* Coordinator: bids */}
      {p.isCoordinator && open && p.bids.length > 0 && (
        <ul className="pool-bids">
          {p.bids.filter((b) => b.status === 'PENDING').map((b) => (
            <li key={b.id}>
              <span><strong>{inr(b.pricePerTon)}/t</strong> · {b.buyerName} · pickup {fmtDate(b.pickupDate)} · about {inr(b.pricePerTon * p.totalTonnes)} total</span>
              <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy || !p.reachedMinimum} onClick={() => act(`/pools/${p.id}/bids/${b.id}/accept`, { method: 'POST' }, 'Bid accepted. Members are notified.')}>Accept</button>
            </li>
          ))}
        </ul>
      )}
      {p.isCoordinator && p.status === 'RESERVED' && (
        <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={() => window.confirm('Confirm the buyer collected everything? Payment will be split between members.') && act(`/pools/${p.id}/complete`, { method: 'POST' }, 'Collected. Members are paid.')}>
          Mark collected & pay members
        </button>
      )}
      {p.isCoordinator && ['OPEN', 'RESERVED'].includes(p.status) && (
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" disabled={busy} onClick={() => window.confirm('Cancel this pool? All members are told.') && act(`/pools/${p.id}/cancel`, { method: 'POST' }, 'Pool cancelled.')}>Cancel pool</button>
      )}

      {/* Buyer actions */}
      {isBuyer && open && p.reachedMinimum && !p.myBidId && (
        <form className="pool-inline" onSubmit={(e) => { e.preventDefault(); act(`/pools/${p.id}/bids`, { method: 'POST', body: { pricePerTon: Number(price), pickupDate: pickup } }, 'Bid placed.'); }}>
          <input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="₹ per ton" aria-label="Price per ton" />
          <input type="date" min={todayIST()} value={pickup} onChange={(e) => setPickup(e.target.value)} aria-label="Pickup date" />
          <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy || !price}>Bid for {p.totalTonnes} t</button>
        </form>
      )}
      {isBuyer && open && !p.reachedMinimum && <p className="proc-hint">Bidding opens once {p.minTonnes} t are pooled.</p>}
      {isBuyer && p.myBidId && open && (
        <div className="pool-inline">
          <span className="proc-hint">Your bid: {inr(p.bids.find((b) => b.mine)?.pricePerTon)}/t (private)</span>
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" disabled={busy} onClick={() => act(`/pools/${p.id}/bids/mine`, { method: 'DELETE' }, 'Bid withdrawn.')}>Withdraw</button>
        </div>
      )}
      {isBuyer && p.status === 'RESERVED' && p.bids.some((b) => b.mine && b.status === 'ACCEPTED') && (
        <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={() => window.confirm('Confirm you collected the straw? Your wallet is charged.') && act(`/pools/${p.id}/complete`, { method: 'POST' }, 'Collected and paid.')}>
          Confirm pickup & pay
        </button>
      )}
    </article>
  );
};
