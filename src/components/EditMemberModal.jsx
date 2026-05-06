import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

const ROLES = ['nonno', 'nonna', 'mamma', 'papà', 'figlio', 'figlia', 'fratello', 'sorella', 'zio', 'zia', 'cugino', 'cugina', 'altro', 'tu'];
const COLORS = ['#1C1611', '#2A6FDB', '#C96A3A', '#2E7D52', '#9B59B6', '#E91E8C', '#E67E22', '#7C3AED', '#5A4A3A', '#8B6F5E'];

export default function EditMemberModal({ member, onClose, onSaved }) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role || 'altro');
  const [color, setColor] = useState(member.avatar_color || COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setErr('');
    const { error } = await supabase.from('members').update({
      name: name.trim(),
      role,
      avatar_color: color,
      avatar_letter: name.trim().charAt(0).toUpperCase(),
    }).eq('id', member.id);
    if (error) { setErr(error.message); setBusy(false); }
    else onSaved && onSaved();
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Modifica membro</h2>
        <p className="modal-sub">{member.user_id ? 'Questo membro ha un account.' : 'Membro senza account.'}</p>

        <form onSubmit={submit}>
          <label htmlFor="name">Nome</label>
          <input id="name" className="input" autoFocus
            value={name} onChange={(e) => setName(e.target.value)} />

          <div style={{ marginTop: 16 }}>
            <label>Ruolo</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ROLES.map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  style={{
                    padding: '6px 12px', borderRadius: 100, border: '1.5px solid',
                    borderColor: role === r ? 'var(--k)' : 'var(--sm)',
                    background: role === r ? 'var(--sm)' : 'white',
                    fontSize: 12, fontWeight: 600,
                  }}>{r}</button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label>Colore avatar</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  style={{
                    width: 36, height: 36, borderRadius: 12, background: c,
                    border: color === c ? '3px solid var(--k)' : '1.5px solid var(--sm)',
                  }} />
              ))}
            </div>
          </div>

          {err && <div className="login-msg error" style={{ marginTop: 12 }}>{err}</div>}

          <div className="row" style={{ marginTop: 20 }}>
            <button type="button" className="btn secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn" disabled={busy || !name.trim()}>
              {busy ? <span className="spin" /> : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
