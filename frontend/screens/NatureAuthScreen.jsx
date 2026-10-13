import React, { useState } from 'react';
import { login, register, requestOtp, verifyOtp } from '../utils/authService.js';
import { useI18n, LanguageSelect } from '../utils/i18n.jsx';
import './NatureAuthScreen.css';

const ROLE_LABELS = {
  FARMER: 'Farmer',
  FPO: 'Farmer Producer Organisation',
  BUYER: 'Buyer',
  HOUSEHOLD: 'Household',
  BIOGAS: 'Biogas plant',
  LEARNER: 'Learner',
  MARKET: 'Market prices'
};

const BUYER_TYPES = [
  ['INDIVIDUAL', 'Individual'],
  ['RESTAURANT', 'Restaurant / hotel'],
  ['RETAILER', 'Retailer'],
  ['PROCESSOR', 'Food processor'],
  ['INSTITUTION', 'Institution (school, hospital…)'],
  ['WHOLESALER', 'Wholesaler']
];

// role: the card picked on the landing page (used when creating an account).
// Staff accounts (procurement managers, admin) are created by the platform and just log in here.
export const NatureAuthScreen = ({ role, onAuthComplete, onBack }) => {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', location: '', buyerType: 'INDIVIDUAL' });
  const { t } = useI18n();
  const [useOtp, setUseOtp] = useState(false);
  const [otpStep, setOtpStep] = useState('phone'); // phone -> code
  const [code, setCode] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canRegister = Boolean(ROLE_LABELS[role]);

  const handleOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (otpStep === 'phone') {
        await requestOtp(form.phone);
        setInfo(t('auth.codeSent'));
        setOtpStep('code');
      } else {
        onAuthComplete(await verifyOtp(form.phone, code));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user =
        mode === 'login'
          ? await login(form.email.trim(), form.password)
          : await register({
              name: form.name,
              email: form.email.trim(),
              password: form.password,
              phone: form.phone,
              location: form.location,
              role,
              ...(role === 'BUYER' ? { buyerType: form.buyerType } : {})
            });
      onAuthComplete(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">{mode === 'login' ? t('auth.welcome') : 'Join AgriLoop'}</h2>
        <LanguageSelect className="auth-lang" />
        {canRegister && (
          <div className="auth-switch" role="tablist" aria-label="Log in or create an account">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
              Log in
            </button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
              Create account
            </button>
          </div>
        )}
        {mode === 'register' && <p className="auth-role-note">Signing up as a <strong>{ROLE_LABELS[role]}</strong></p>}

        {mode === 'login' && useOtp ? (
          <form onSubmit={handleOtp} className="auth-form" noValidate>
            <input type="tel" inputMode="numeric" placeholder={t('auth.phone')} value={form.phone} onChange={set('phone')} className="auth-input" autoComplete="tel" aria-label={t('auth.phone')} disabled={otpStep === 'code'} />
            {otpStep === 'code' && (
              <input type="text" inputMode="numeric" maxLength={6} placeholder={t('auth.code')} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="auth-input" autoComplete="one-time-code" aria-label={t('auth.code')} />
            )}
            {info && <p className="auth-role-note">{info}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="auth-button" disabled={busy}>
              {busy ? '…' : otpStep === 'phone' ? t('auth.sendCode') : t('auth.verify')}
            </button>
            <button type="button" className="auth-back" onClick={() => { setUseOtp(false); setOtpStep('phone'); setCode(''); setError(''); setInfo(''); }}>
              {t('auth.useEmail')}
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {mode === 'register' && (
            <input type="text" placeholder="Full name" value={form.name} onChange={set('name')} className="auth-input" autoComplete="name" required aria-label="Full name" />
          )}
          <input type="email" placeholder="Email" value={form.email} onChange={set('email')} className="auth-input" autoComplete="email" required aria-label="Email" />
          <input
            type="password"
            placeholder={mode === 'register' ? 'Password (8+ characters)' : 'Password'}
            value={form.password}
            onChange={set('password')}
            className="auth-input"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            required
            aria-label="Password"
          />
          {mode === 'register' && (
            <>
              <input type="tel" placeholder="Phone number" value={form.phone} onChange={set('phone')} className="auth-input" autoComplete="tel" aria-label="Phone number" />
              <input type="text" placeholder="Village / town, State" value={form.location} onChange={set('location')} className="auth-input" aria-label="Location" />
              {role === 'BUYER' && (
                <select value={form.buyerType} onChange={set('buyerType')} className="auth-input" aria-label="Type of buyer">
                  {BUYER_TYPES.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              )}
            </>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" className="auth-button" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? t('auth.login') : t('auth.register')}
          </button>
          {mode === 'login' && (
            <button type="button" className="auth-back" onClick={() => { setUseOtp(true); setError(''); }}>
              {t('auth.useOtp')}
            </button>
          )}
        </form>
        )}

        {onBack && (
          <button type="button" className="auth-back" onClick={onBack}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
};
