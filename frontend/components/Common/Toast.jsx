import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import './ui.css';

// App-wide toasts (replaces window.alert in new screens)
const ToastContext = createContext({ show: () => {} });

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message, { tone = 'success', duration = 4500 } = {}) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-3), { id, message, tone }]);
      if (duration) setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const Icon = { success: CheckCircle2, error: AlertTriangle, info: Info };
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="ui-toasts" role="status" aria-live="polite">
        {toasts.map((t) => {
          const I = Icon[t.tone] || Info;
          return (
            <div key={t.id} className={`ui-toast ui-toast-${t.tone}`}>
              <I size={18} />
              <span>{t.message}</span>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const { show } = useContext(ToastContext);
  return {
    success: (m) => show(m, { tone: 'success' }),
    error: (m) => show(m, { tone: 'error', duration: 7000 }),
    info: (m) => show(m, { tone: 'info' })
  };
};
