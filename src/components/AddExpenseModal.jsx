import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useT } from '../lib/i18n.jsx';

export default function AddExpenseModal({ familyId, families = [], members, defaultPaidBy, onClose, onCreated }) {
  const { t } = useT();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState(defaultPaidBy || members[0]?.id || '');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [splitMode, setSplitMode] = useState('equal'); // 'equal' | 'custom'
  const [splitMembers, setSplitMembers] = useState([]); // member.id array
  const [customAmounts, setCustomAmounts] = useState({}); // {member_id: number}
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Membri raggruppati per famiglia
  const byFamily = families.map((f) => ({
    family: f,
    members: members.filter((m) => m.family_id === f.id),
  })).filter((g) => g.members.length > 0);

  const totalAmount = parseFloat((amount || '0').replace(',', '.')) || 0;

  const equalShare = useMemo(() => {
    if (splitMembers.length === 0) return 0;
    return Math.round((totalAmount / splitMembers.length) * 100) / 100;
  }, [totalAmount, splitMembers]);

  const customTotal = useMemo(() => {
    return splitMembers.reduce((s, mid) => s + (parseFloat(customAmounts[mid]) || 0), 0);
  }, [splitMembers, customAmounts]);

  const toggleSplitMember = (id) => {
    setSplitMembers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!totalAmount || totalAmount <= 0) return;
    setBusy(true); setErr('');

    const { data: expense, error: e1 } = await supabase.from('expenses').insert({
      family_id: familyId,
      amount: totalAmount,
      currency: 'EUR',
      description: description.trim() || null,
      paid_by: paidBy || null,
      paid_at: paidAt || null,
    }).select().single();

    if (e1) { setErr(e1.message); setBusy(false); return; }

    // Inserisci le quote
    if (splitMembers.length > 0) {
      const shares = splitMembers.map((mid) => ({
        expense_id: expense.id,
        member_id: mid,
        amount: splitMode === 'equal'
          ? equalShare
          : (parseFloat(customAmounts[mid]) || 0),
        // Se la quota è di chi ha pagato, è già "settled" automaticamente
        settled: mid === paidBy,
        settled_at: mid === paidBy ? new Date().toISOString() : null,
      }));
      const { error: e2 } = await supabase.from('expense_shares').insert(shares);
      if (e2) { setErr(e2.message); setBusy(false); return; }
    }

    onCreated && onCreated();
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('addexpense_h')}</h2>
        <p className="modal-sub">{t('addexpense_sub')}</p>

        <form onSubmit={submit}>
          <label htmlFor="amount">{t('addexpense_amount')}</label>
          <input id="amount" className="input" autoFocus inputMode="decimal"
            placeholder="0,00"
            value={amount} onChange={(e) => setAmount(e.target.value)} />

          <div style={{ marginTop: 16 }}>
            <label htmlFor="desc">{t('addexpense_desc')}</label>
            <input id="desc" className="input"
              placeholder={t('addexpense_desc_ph')}
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div style={{ marginTop: 16 }}>
            <label htmlFor="who">{t('addexpense_paid_by')}</label>
            <select id="who" className="input"
              value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div style={{ marginTop: 16 }}>
            <label htmlFor="when">{t('addexpense_when')}</label>
            <input id="when" type="date" className="input"
              value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>

          {/* Split section */}
          <div style={{ marginTop: 20, padding: 14, background: 'var(--ab)', borderRadius: 14, border: '1px solid var(--sm)' }}>
            <label style={{ marginBottom: 4 }}>{t('expenses_split_label')}</label>
            <div style={{ fontSize: 11, color: 'var(--km)', marginBottom: 8, lineHeight: 1.4 }}>
              {t('expenses_split_hint')}
            </div>

            {/* Modalità split */}
            {splitMembers.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button type="button" onClick={() => setSplitMode('equal')}
                  style={chip(splitMode === 'equal')}>{t('expenses_split_mode_equal')}</button>
                <button type="button" onClick={() => setSplitMode('custom')}
                  style={chip(splitMode === 'custom')}>{t('expenses_split_mode_custom')}</button>
              </div>
            )}

            {/* Selezione membri raggruppati per famiglia */}
            <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 8 }}>
              {byFamily.map((g) => (
                <div key={g.family.id} style={{ marginBottom: 12, padding: 10, background: 'white', border: '1px solid var(--sm)', borderRadius: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--km)', marginBottom: 8 }}>
                    {g.family.emoji} {g.family.name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {g.members.map((m) => {
                      const selected = splitMembers.includes(m.id);
                      return (
                        <button key={m.id} type="button" onClick={() => toggleSplitMember(m.id)}
                          style={chipMember(selected, m)}>
                          {selected && <span>✓ </span>}
                          <Avatar m={m} small />
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Riepilogo split */}
            {splitMembers.length > 0 && splitMode === 'equal' && totalAmount > 0 && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ac)', fontWeight: 600 }}>
                {t('expenses_split_each')}: € {equalShare.toFixed(2)}
              </div>
            )}

            {/* Input custom per ogni membro */}
            {splitMembers.length > 0 && splitMode === 'custom' && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {splitMembers.map((mid) => {
                  const m = members.find((x) => x.id === mid);
                  return (
                    <div key={mid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar m={m} />
                      <span style={{ flex: 1, fontSize: 13 }}>{m?.name}</span>
                      <input type="number" step="0.01" inputMode="decimal" className="input" style={{ width: 100 }}
                        placeholder="0,00"
                        value={customAmounts[mid] || ''}
                        onChange={(e) => setCustomAmounts({ ...customAmounts, [mid]: e.target.value })} />
                      <span style={{ fontSize: 12, color: 'var(--km)' }}>€</span>
                    </div>
                  );
                })}
                <div style={{ marginTop: 4, fontSize: 12, textAlign: 'right',
                  color: Math.abs(customTotal - totalAmount) < 0.01 ? 'var(--gn)' : 'var(--rd)', fontWeight: 600 }}>
                  {t('expenses_split_remaining')}: € {(totalAmount - customTotal).toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {err && <div className="login-msg error" style={{ marginTop: 12 }}>{err}</div>}

          <div className="row" style={{ marginTop: 20 }}>
            <button type="button" className="btn secondary" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="btn" disabled={busy || !totalAmount}>
              {busy ? <span className="spin" /> : t('add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Avatar({ m, small }) {
  if (!m) return null;
  const size = small ? 18 : 22;
  return (
    <span style={{
      width: size, height: size, borderRadius: small ? 6 : 7,
      background: m.avatar_color || '#1C1611', color: 'white',
      fontSize: small ? 10 : 11, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>{m.avatar_letter || m.name.charAt(0).toUpperCase()}</span>
  );
}

function chip(active) {
  return {
    padding: '6px 12px', borderRadius: 100, border: '1.5px solid',
    borderColor: active ? 'var(--ac)' : 'var(--sm)',
    background: active ? 'var(--ac)' : 'white',
    color: active ? 'white' : 'var(--k)',
    fontSize: 12, fontWeight: 600,
  };
}

function chipMember(selected, m) {
  return {
    padding: '6px 10px', borderRadius: 100, border: '1.5px solid',
    borderColor: selected ? 'var(--k)' : 'var(--sm)',
    background: selected ? 'var(--k)' : 'white',
    color: selected ? 'white' : 'var(--k)',
    fontSize: 12, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 6,
  };
}
