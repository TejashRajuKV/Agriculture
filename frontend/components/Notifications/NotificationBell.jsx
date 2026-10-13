import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../../utils/apiClient.js';
import { useApi } from '../../utils/hooks.js';
import { timeAgo } from '../../utils/format.js';
import './NotificationBell.css';

const POLL_MS = 15000;

// onOpen(reference) -> the app navigates to the booking / order / listing it refers to
export const NotificationBell = ({ onOpen }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const { data, reload, setData } = useApi(() => api('/notifications?limit=20'), [], { pollMs: POLL_MS });
  const unread = data?.unread || 0;

  useEffect(() => {
    if (!open) return undefined;
    reload({ quiet: true });
    const onDoc = (e) => !wrapRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, reload]);

  const markRead = (n) => {
    if (n.isRead) return;
    setData((d) => d && { ...d, unread: Math.max(0, d.unread - 1), items: d.items.map((i) => (i.id === n.id ? { ...i, isRead: true } : i)) });
    api(`/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {});
  };

  const markAll = async () => {
    setData((d) => d && { ...d, unread: 0, items: d.items.map((i) => ({ ...i, isRead: true })) });
    await api('/notifications/read-all', { method: 'PATCH' }).catch(() => {});
  };

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="notif-bell"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell size={20} />
        {unread > 0 && <span className="notif-count">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="notif-markall">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <ul className="notif-list">
            {!data && <li className="notif-empty">Loading…</li>}
            {data?.items.length === 0 && <li className="notif-empty">No notifications yet.</li>}
            {data?.items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`notif-item ${n.isRead ? '' : 'unread'}`}
                  onClick={() => {
                    markRead(n);
                    if (n.referenceType) {
                      onOpen?.({ type: n.referenceType, id: n.referenceId });
                      setOpen(false);
                    }
                  }}
                >
                  <span className="notif-title">{n.title}</span>
                  <span className="notif-msg">{n.message}</span>
                  <span className="notif-time">{timeAgo(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
