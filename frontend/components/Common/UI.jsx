import React, { useEffect, useRef } from 'react';
import { X, AlertTriangle, Inbox, Loader2, CheckCircle2, Circle } from 'lucide-react';
import './ui.css';

// One colour language for every status in the app (procurement, payments, orders, listings)
const TONES = {
  success: ['COMPLETED', 'PAID', 'DELIVERED', 'ACCEPTED', 'ACTIVE', 'OPEN', 'ARRIVED'],
  info: ['CONFIRMED', 'BOOKED', 'WAITING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'NOT_JOINED', 'QUALITY_CHECK'],
  warning: ['PENDING', 'PROCESSING', 'CALLED', 'WEIGHING', 'PARTIALLY_ACCEPTED', 'RESERVED'],
  danger: ['FAILED', 'REJECTED', 'CANCELLED', 'NO_SHOW', 'SKIPPED'],
  neutral: ['SOLD_OUT', 'DRAFT', 'EXPIRED', 'CLOSED']
};
const LABELS = {
  NOT_JOINED: 'Not checked in',
  READY_FOR_PICKUP: 'Ready for pickup',
  QUALITY_CHECK: 'Quality check',
  PARTIALLY_ACCEPTED: 'Partly accepted',
  SOLD_OUT: 'Sold out',
  NO_SHOW: 'No-show',
  IN_TRANSIT: 'In transit',
  PICKED_UP: 'Picked up'
};

export const statusTone = (status) => Object.keys(TONES).find((t) => TONES[t].includes(status)) || 'neutral';
export const statusLabel = (status) =>
  LABELS[status] || String(status || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export const StatusBadge = ({ status, label, tone, className = '' }) => (
  <span className={`ui-badge ui-badge-${tone || statusTone(status)} ${className}`}>{label || statusLabel(status)}</span>
);

export const Modal = ({ title, onClose, children, footer, size = 'md', labelId = 'ui-modal-title' }) => {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector('input, select, textarea, button:not(.ui-modal-close)')?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="ui-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} className={`ui-modal ui-modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={labelId}>
        <div className="ui-modal-header">
          <h3 id={labelId}>{title}</h3>
          {onClose && (
            <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export const EmptyState = ({ icon: Icon = Inbox, title, text, action }) => (
  <div className="ui-state">
    <div className="ui-state-icon"><Icon size={28} /></div>
    <p className="ui-state-title">{title}</p>
    {text && <p className="ui-state-text">{text}</p>}
    {action}
  </div>
);

export const LoadingState = ({ text = 'Loading…' }) => (
  <div className="ui-state ui-state-loading" role="status">
    <Loader2 size={26} className="ui-spin" />
    <p className="ui-state-text">{text}</p>
  </div>
);

export const ErrorState = ({ error, onRetry }) => (
  <div className="ui-state ui-state-error" role="alert">
    <div className="ui-state-icon"><AlertTriangle size={26} /></div>
    <p className="ui-state-title">Couldn't load this</p>
    <p className="ui-state-text">{error?.message || String(error)}</p>
    {onRetry && (
      <button type="button" className="ui-btn ui-btn-outline" onClick={() => onRetry()}>
        Try again
      </button>
    )}
  </div>
);

// Vertical progress timeline; each step: { key, label, done, at, detail }
export const Timeline = ({ steps }) => {
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="ui-timeline">
      {steps.map((s, i) => (
        <li key={s.key} className={`ui-timeline-step ${s.done ? 'done' : ''} ${i === current ? 'current' : ''}`}>
          <span className="ui-timeline-dot" aria-hidden="true">
            {s.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </span>
          <div className="ui-timeline-body">
            <p className="ui-timeline-label">
              {s.label}
              <span className="sr-only">{s.done ? ' (done)' : i === current ? ' (in progress)' : ' (pending)'}</span>
            </p>
            {(s.at || s.detail) && (
              <p className="ui-timeline-meta">
                {s.at ? new Date(s.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}
                {s.at && s.detail ? ' · ' : ''}
                {s.detail}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
};

// Simple labelled stat tile
export const Stat = ({ label, value, hint, tone }) => (
  <div className={`ui-stat ${tone ? `ui-stat-${tone}` : ''}`}>
    <p className="ui-stat-label">{label}</p>
    <p className="ui-stat-value">{value}</p>
    {hint && <p className="ui-stat-hint">{hint}</p>}
  </div>
);
