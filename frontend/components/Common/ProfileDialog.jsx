import React, { useState } from 'react';
import { api } from '../../utils/apiClient.js';
import { useAction } from '../../utils/hooks.js';
import { Modal } from './UI.jsx';
import { useToast } from './Toast.jsx';

// Edit name, phone and location. Location is looked up on the map so procurement
// centre distances and weather default to the right place.
export const ProfileDialog = ({ user, onClose, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', location: user.location || '' });
  const [error, setError] = useState('');
  const [busy, run] = useAction();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = () =>
    run(async () => {
      setError('');
      try {
        const res = await api('/auth/me', { method: 'PATCH', body: form });
        toast.success(
          form.location && !res.locatedOnMap
            ? 'Profile saved. We could not find that place on the map, so distances are not available. Try "Town, State".'
            : 'Profile saved.'
        );
        onSaved(res.user);
      } catch (err) {
        setError(err.message);
      }
    });

  return (
    <Modal
      title="My profile"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <p className="proc-hint">{user.email} · {user.role.replace(/_/g, ' ').toLowerCase()}{user.farmerCode ? ` · ${user.farmerCode}` : ''}</p>
      <label className="ui-field"><span>Name</span><input value={form.name} onChange={set('name')} maxLength={80} /></label>
      <label className="ui-field"><span>Phone number</span><input type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="10-digit mobile number" /></label>
      <label className="ui-field">
        <span>Village / town, State</span>
        <input value={form.location} onChange={set('location')} placeholder="e.g. Maddur, Karnataka" maxLength={120} />
        <small>Used to show the nearest procurement centres.</small>
      </label>
      {error && <p className="ui-field-error" role="alert">{error}</p>}
    </Modal>
  );
};
