import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useT } from '../lib/i18n.jsx';

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AddTaskModal({ familyId, families = [], members, authorMemberId, onClose, onCreated }) {
  const { t } = useT();
  const CATEGORIES = [
    { id: 'care',   emoji: '❤️', label: t('cat_care') },
    { id: 'home',   emoji: '🏠', label: t('cat_home') },
    { id: 'health', emoji: '💊', label: t('cat_health') },
    { id: 'admin',  emoji: '📋', label: t('cat_admin') },
    { id: 'spese',  emoji: '💶', label: t('cat_spese') },
    { id: 'other',  emoji: '📌', label: t('cat_other') },
  ];

  const [step, setStep] = useState(1); // 1: titolo+cat, 2: assegna+data, 3: note+ricorrenza
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('care');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [recurringDays, setRecurringDays] = useState([]);
  const [recurringUntil, setRecurringUntil] = useState('');
  const [taskFamily, setTaskFamily] = useState(familyId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Membri raggruppati per famiglia
  const byFamily = families.map((f) => ({
    family: f,
    members: members.filter((m) => m.family_id === f.id),
  })).filter((g) => g.members.length > 0);

  const toggleAssignee = (id) => {
    setAssignees((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAllOfFamily = (familyMembers) => {
    const ids = familyMembers.map((m) => m.id);
    const allSelected = ids.every((id) => assignees.includes(id));
    if (allSelected) {
      setAssignees((prev) => prev.filter((x) => !ids.includes(x)));
    } else {
      setAssignees((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const toggleDay = (idx) => {
    setRecurringDays((prev) => prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx].sort((a,b) => a-b));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true); setErr('');

    const { data: task, error: e1 } = await supabase.from('tasks').insert({
      family_id: taskFamily,
      title: title.trim(),
      note: note.trim() || null,
      category,
      status: 'todo',
      visibility: 'all',
      due_date: dueDate || null,
      author_id: authorMemberId || null,
      assigned_to: assignees[0] || null,
      recurring_days: recurringDays.length > 0 ? recurringDays : null,
      recurring_until: recurringDays.length > 0 && recurringUntil ? recurringUntil : null,
    }).select().single();

    if (e1) { setErr(e1.message); setBusy(false); return; }

    if (assignees.length > 0) {
      const rows = assignees.map((memberId) => ({ task_id: task.id, member_id: memberId }));
      await supabase.from('task_assignees').insert(rows);
    }

    onCreated && onCreated();
  };

  const isQuickActive = (offset) => dueDate === dateOffset(offset);
  const weekdays = t('weekday_short');
  const fullWeekdays = t('weekday_full');

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Header con indicatore di step */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          {step === 1 && (
            <button type="button" onClick={() => onClose()} className="link-btn" style={{ fontSize: 20 }}>‹</button>
          )}
          {step > 1 && <div style={{ width: 20 }} />}
          <h2 style={{ flex: 1, margin: 0 }}>{t('addtask_h')}</h2>
          <span style={{ fontSize: 12, color: 'var(--km)', fontWeight: 600 }}>{step}/3</span>
        </div>

        <form onSubmit={step === 3 ? submit : (e) => { e.preventDefault(); }}>
          {/* STEP 1: Titolo + Categoria */}
          {step === 1 && (
            <>
              <label htmlFor="title">{t('addtask_title_label')}</label>
              <input id="title" className="input" autoFocus
                placeholder={t(`addtask_title_ph_${category}`)}
                value={title} onChange={(e) => setTitle(e.target.value)} />

              <div style={{ marginTop: 20 }}>
                <label>{t('addtask_cat_label')}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CATEGORIES.map((c) => (
                    <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                      style={chipStyle(category === c.id)}>
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="row" style={{ marginTop: 28 }}>
                <button type="button" className="btn secondary" onClick={onClose}>{t('cancel')}</button>
                <button type="button" className="btn" onClick={() => setStep(2)} disabled={!title.trim()}>
                  Avanti →
                </button>
              </div>
            </>
          )}

          {/* STEP 2: Assegnazione + Data */}
          {step === 2 && (
            <>
              <label style={{ marginTop: 0 }}>{t('assignee_multi_label')}</label>
              <div style={{ fontSize: 11, color: 'var(--km)', marginBottom: 12 }}>
                {t('assignee_multi_hint')}
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 16 }}>
                {byFamily.map((g) => {
                  const ids = g.members.map((m) => m.id);
                  const allSelected = ids.every((id) => assignees.includes(id));
                  return (
                    <div key={g.family.id} style={{ marginBottom: 12, padding: 10, background: 'white', border: '1px solid var(--sm)', borderRadius: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--km)' }}>
                          {g.family.emoji} {g.family.name}
                        </div>
                        <button type="button" onClick={() => toggleAllOfFamily(g.members)}
                          style={{
                            padding: '4px 10px', borderRadius: 100, border: '1.5px solid var(--sm)',
                            background: allSelected ? 'var(--k)' : 'white',
                            color: allSelected ? 'white' : 'var(--k)',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}>
                          {allSelected ? `✕` : `✓`}
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {g.members.map((m) => {
                          const selected = assignees.includes(m.id);
                          return (
                            <button key={m.id} type="button" onClick={() => toggleAssignee(m.id)}
                              style={chipMember(selected)}>
                              {selected && <span>✓</span>}
                              <span style={avatarStyle(m)}>
                                {m.avatar_letter || m.name.charAt(0).toUpperCase()}
                              </span>
                              {m.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <label htmlFor="due">{t('addtask_when')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                <button type="button" onClick={() => setDueDate(dateOffset(0))}
                  style={chipStyle(isQuickActive(0))}>📍 {t('date_today')}</button>
                <button type="button" onClick={() => setDueDate(dateOffset(1))}
                  style={chipStyle(isQuickActive(1))}>☀️ {t('date_tomorrow')}</button>
                <button type="button" onClick={() => setDueDate(dateOffset(7))}
                  style={chipStyle(isQuickActive(7))}>📅 {t('date_in_a_week')}</button>
              </div>
              <input id="due" type="date" className="input"
                value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

              <div className="row" style={{ marginTop: 24 }}>
                <button type="button" className="btn secondary" onClick={() => setStep(1)}>← Indietro</button>
                <button type="button" className="btn" onClick={() => setStep(3)}>Avanti →</button>
              </div>
            </>
          )}

          {/* STEP 3: Note + Ricorrenza (opzionale) */}
          {step === 3 && (
            <>
              <label htmlFor="note">{t('addtask_note_label')} <span style={{ color: 'var(--km)' }}>(opzionale)</span></label>
              <textarea id="note" className="input" rows={3}
                placeholder={t('addtask_note_ph')}
                value={note} onChange={(e) => setNote(e.target.value)} />

              <div style={{ marginTop: 20, padding: 14, background: 'var(--ab)', borderRadius: 14, border: '1px solid var(--sm)' }}>
                <label style={{ marginBottom: 4 }}>{t('repeat_label')} <span style={{ color: 'var(--km)', fontSize: 11 }}>(opzionale)</span></label>
                <div style={{ fontSize: 11, color: 'var(--km)', marginBottom: 12 }}>
                  {t('repeat_hint')}
                </div>

                {/* Weekday buttons */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--km)', marginBottom: 6, fontWeight: 600 }}>Giorni della settimana</div>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
                    {Array.isArray(weekdays) && weekdays.map((w, idx) => {
                      const selected = recurringDays.includes(idx);
                      return (
                        <button key={idx} type="button" onClick={() => toggleDay(idx)}
                          title={Array.isArray(fullWeekdays) ? fullWeekdays[idx] : ''}
                          style={{
                            flex: 1, height: 32, borderRadius: 6, border: '1.5px solid',
                            borderColor: selected ? 'var(--k)' : 'var(--sm)',
                            background: selected ? 'var(--k)' : 'white',
                            color: selected ? 'white' : 'var(--k)',
                            fontSize: 11, fontWeight: 700,
                          }}>{w}</button>
                      );
                    })}
                  </div>
                </div>

                {/* Monthly calendar */}
                <div>
                  <div style={{ fontSize: 10, color: 'var(--km)', marginBottom: 6, fontWeight: 600 }}>
                    Oppure seleziona specifici giorni del mese
                  </div>
                  <MonthCalendarPicker
                    selectedDays={recurringDays.filter((d) => d > 6)}
                    onToggleDay={(day) => {
                      setRecurringDays((prev) =>
                        prev.includes(day)
                          ? prev.filter((x) => x !== day)
                          : [...prev, day].sort((a,b) => a-b)
                      );
                    }}
                  />
                </div>

                {recurringDays.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <label htmlFor="until" style={{ fontSize: 11, color: 'var(--km)' }}>{t('repeat_until')}</label>
                    <input id="until" type="date" className="input" style={{ marginTop: 4 }}
                      value={recurringUntil} onChange={(e) => setRecurringUntil(e.target.value)} />
                  </div>
                )}
              </div>

              {err && <div className="login-msg error" style={{ marginTop: 12 }}>{err}</div>}

              <div className="row" style={{ marginTop: 24 }}>
                <button type="button" className="btn secondary" onClick={() => setStep(2)}>← Indietro</button>
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? <span className="spin" /> : t('add')}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function chipStyle(active) {
  return {
    padding: '6px 12px', borderRadius: 100, border: '1.5px solid',
    borderColor: active ? 'var(--k)' : 'var(--sm)',
    background: active ? 'var(--sm)' : 'white',
    fontSize: 12, fontWeight: 600,
  };
}

function chipMember(selected) {
  return {
    padding: '6px 10px', borderRadius: 100, border: '1.5px solid',
    borderColor: selected ? 'var(--k)' : 'var(--sm)',
    background: selected ? 'var(--k)' : 'white',
    color: selected ? 'white' : 'var(--k)',
    fontSize: 12, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 6,
  };
}

function avatarStyle(m) {
  return {
    width: 18, height: 18, borderRadius: 6,
    background: m.avatar_color || '#1C1611', color: 'white',
    fontSize: 10, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}

function MonthCalendarPicker({ selectedDays, onToggleDay }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

  const days = [];
  // Add empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  // Add days of month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  const weekdayLabels = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  return (
    <div>
      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
        {weekdayLabels.map((label) => (
          <div key={label} style={{
            textAlign: 'center', fontSize: 9, fontWeight: 700,
            color: 'var(--km)', textTransform: 'uppercase',
          }}>{label}</div>
        ))}
      </div>
      {/* Calendar days */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {days.map((day, idx) => (
          day ? (
            <button
              key={idx}
              type="button"
              onClick={() => onToggleDay(day + 6)} // +6 to avoid conflict with weekday indices 0-6
              style={{
                aspectRatio: '1', borderRadius: 4, border: '1.5px solid',
                borderColor: selectedDays.includes(day + 6) ? 'var(--k)' : 'var(--sm)',
                background: selectedDays.includes(day + 6) ? 'var(--k)' : 'white',
                color: selectedDays.includes(day + 6) ? 'white' : 'var(--k)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0,
              }}
            >{day}</button>
          ) : (
            <div key={idx} />
          )
        ))}
      </div>
    </div>
  );
}
