import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGES, STRINGS } from '../locales/strings.js';

const KEY = 'agriloop_lang';
const I18nContext = createContext(null);

const readSaved = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGUAGES[saved]) return saved;
  } catch { /* storage unavailable */ }
  const browser = (navigator.language || 'en').slice(0, 2);
  return LANGUAGES[browser] ? browser : 'en';
};

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(readSaved);
  const setLang = useCallback((l) => {
    if (!LANGUAGES[l]) return;
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const value = useMemo(() => {
    // {name} placeholders; missing keys fall back to English, then to the key text
    const t = (key, vars) => {
      let text = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, v);
      return text;
    };
    return { lang, setLang, t, speechLang: LANGUAGES[lang].speech };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

// Outside a provider (tests, isolated screens) fall back to English instead of crashing
const fallback = { lang: 'en', setLang: () => {}, t: (k) => STRINGS.en[k] ?? k, speechLang: 'en-IN' };
export const useI18n = () => useContext(I18nContext) || fallback;

export const LanguageSelect = ({ className = '' }) => {
  const { lang, setLang, t } = useI18n();
  return (
    <select className={`lang-select ${className}`} value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('lang.label')} title={t('lang.label')}>
      {Object.entries(LANGUAGES).map(([code, l]) => (
        <option key={code} value={code}>{l.native}</option>
      ))}
    </select>
  );
};
