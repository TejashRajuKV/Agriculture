import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useI18n } from '../../utils/i18n.jsx';
import { timeAgo } from '../../utils/format.js';

// Shown when the phone has no connection. Screens that keep an offline copy say how old it is.
export const OfflineBanner = () => {
  const { t } = useI18n();
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <WifiOff size={16} /> {t('offline.banner')}
    </div>
  );
};

// Small "Saved 5 min ago" note for data that came from the offline copy
export const SavedNote = ({ savedAt }) => {
  const { t } = useI18n();
  if (!savedAt) return null;
  return <p className="proc-hint offline-saved">{t('offline.saved', { time: timeAgo(savedAt) })}</p>;
};
