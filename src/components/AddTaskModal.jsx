import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useT } from '../lib/i18n.jsx';

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  if (!dateStr) return 'Non impostata';
  const d = new Date(dateStr);
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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

  const [step, setStep] = useState(1); // 1: titolo+cat+data, 2: assegnazioni, 3: note+ricorrenza+foto
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
  const [attachments, setAttachments] = useState([]);
  const [expandedFamilies, setExpandedFamilies] = useState({}); // {familyId: boolean}
  const [expandRecurring, setExpandRecurring] = useState(false);

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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setAttachments((prev) => [...prev, {
          file,
          preview: evt.target.result,
          name: file.name,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
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

    // Upload allegati
    if (attachments.length > 0) {
      for (const att of attachments) {
        const timestamp = Date.now();
        const fileName = `${timestamp}-${att.file.name}`;
        const filePath = `tasks/${task.id}/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, att.file);

        if (!uploadErr) {
          try {
            await supabase.from('task_attachments').insert({
              task_id: task.id,
              file_path: filePath,
              file_name: att.file.name,
            });
          } catch (dbErr) {
            console.warn('task_attachments table not yet created:', dbErr);
          }
        }
      }
    }

    onCreated && onCreated();
  };

  const isQuickActive = (offset) => dueDate === dateOffset(offset);
  const weekdays = t('weekday_short');
  const fullWeekdays = t('weekday_full');

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--sm)' }}>
          <h2 style={{ flex: 1, margin: 0, fontSize: 16 }}>{t('addtask_h')}</h2>
          <span style={{ fontSize: 12, color: 'var(--km)', fontWeight: 600 }}>{step}/3</span>
        </div>

        <form onSubmit={step === 3 ? submit : (e) => { e.preventDefault(); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* STEP 1: Titolo + Categoria + DATA PRINCIPALE */}
          {step === 1 && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
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

                {/* Data principale - STEP 1 */}
                <div style={{ marginTop: 20 }}>
                  <label>{t('addtask_when')}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    <button type="button" onClick={() => setDueDate(dateOffset(0))}
                      style={chipStyle(isQuickActive(0))}>📍 {t('date_today')}</button>
                    <button type="button" onClick={() => setDueDate(dateOffset(1))}
                      style={chipStyle(isQuickActive(1))}>☀️ {t('date_tomorrow')}</button>
                    <button type="button" onClick={() => setDueDate(dateOffset(7))}
                      style={chipStyle(isQuickActive(7))}>📅 {t('date_in_a_week')}</button>
                  </div>
                  <input type="date" className="input"
                    value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>

              <div className="row" style={{ marginTop: 20 }}>
                <button type="button" className="btn secondary" onClick={onClose}>{t('cancel')}</button>
                <button type="button" className="btn" onClick={() => setStep(2)} disabled={!title.trim()}>
                  Avanti →
                </button>
              </div>
            </>
          )}

          {/* STEP 2: Assegnazione (Tendinata per famiglia) */}
          {step === 2 && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, minHeight: 0 }}>
                <label style={{ marginTop: 0 }}>{t('assignee_multi_label')}</label>
                <div style={{ fontSize: 11, color: 'var(--km)', marginBottom: 12 }}>
                  {t('assignee_multi_hint')}
                </div>

                <div style={{ marginBottom: 16 }}>
                  {byFamily.map((g) => {
                    const ids = g.members.map((m) => m.id);
                    const allSelected = ids.every((id) => assignees.includes(id));
                    const someSelected = assignees.some((id) => ids.includes(id));
                    const isExpanded = expandedFamilies[g.family.id] || false;
                    const selectedCount = ids.filter((id) => assignees.includes(id)).length;

                    return (
                      <div key={g.family.id} style={{ marginBottom: 12, border: '1px solid var(--sm)', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
                        {/* Header tendina */}
                        <button type="button"
                          onClick={() => setExpandedFamilies((prev) => ({ ...prev, [g.family.id]: !isExpanded }))}
                          style={{
                            width: '100%', padding: '12px 12px', display: 'flex', alignItems: 'center', gap: 10,
                            border: 'none', background: 'white', cursor: 'pointer', textAlign: 'left',
                            borderBottom: isExpanded ? '1px solid var(--sm)' : 'none',
                          }}>
                          <span style={{ fontSize: 24 }}>{g.family.emoji}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{g.family.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--km)' }}>
                              {selectedCount > 0 ? `${selectedCount}/${ids.length} selezionati` : 'Nessuno selezionato'}
                            </div>
                          </div>
                          <span style={{ fontSize: 20, color: 'var(--km)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)' }}>›</span>
                        </button>

                        {/* Contenuto tendina */}
                        {isExpanded && (
                          <div style={{ padding: 12, background: 'var(--ab)', borderTop: '1px solid var(--sm)' }}>
                            {/* Seleziona tutti */}
                            <button type="button" onClick={() => toggleAllOfFamily(g.members)}
                              style={{
                                width: '100%', marginBottom: 10, padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--sm)',
                                background: allSelected ? 'var(--k)' : 'white',
                                color: allSelected ? 'white' : 'var(--k)',
                                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              }}>
                              {allSelected ? '✓ Deseleziona tutti' : '+ Seleziona tutti'}
                            </button>

                            {/* Membri singoli */}
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
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="row" style={{ marginTop: 20 }}>
                <button type="button" className="btn secondary" onClick={() => setStep(1)}>← Indietro</button>
                <button type="button" className="btn" onClick={() => setStep(3)}>Avanti →</button>
              </div>
            </>
          )}

          {/* STEP 3: Note + Ricorrenza (tendinata) + Foto */}
          {step === 3 && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, minHeight: 0 }}>
                {/* Preview data scelta */}
                <div style={{ padding: 14, background: 'var(--ab)', borderRadius: 14, border: '1px solid var(--sm)', marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--km)', marginBottom: 4 }}>📅 Data</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--k)' }}>{formatDate(dueDate)}</div>
                </div>

                <label htmlFor="note">{t('addtask_note_label')} <span style={{ color: 'var(--km)' }}>(opzionale)</span></label>
                <textarea id="note" className="input" rows={3}
                  placeholder={t('addtask_note_ph')}
                  value={note} onChange={(e) => setNote(e.target.value)} />

                {/* Ricorrenza - TENDINATA */}
                <button type="button" onClick={() => setExpandRecurring(!expandRecurring)}
                  style={{
                    width: '100%', marginTop: 20, padding: 14, background: 'white', border: '1px solid var(--sm)',
                    borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    textAlign: 'left',
                  }}>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
                    {recurringDays.length > 0 ? `🔄 Ricorre ${recurringDays.length}x` : '🔄 Aggiungi ricorrenza'}
                  </span>
                  <span style={{ fontSize: 20, color: 'var(--km)', transition: 'transform 0.2s', transform: expandRecurring ? 'rotate(90deg)' : 'rotate(0)' }}>›</span>
                </button>

                {/* Contenuto ricorrenza */}
                {expandRecurring && (
                  <div style={{ marginTop: 12, padding: 14, background: 'var(--ab)', borderRadius: 14, border: '1px solid var(--sm)' }}>
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
                )}

                {/* Foto/Allegati */}
                <div style={{ marginTop: 20 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span>📸 Allega foto <span style={{ color: 'var(--km)', fontSize: 11 }}>(opzionale)</span></span>
                  </label>
                  <input type="file" id="file-input" multiple accept="image/*" capture
                    onChange={handleFileSelect}
                    style={{ display: 'none' }} />
                  <button type="button" onClick={() => document.getElementById('file-input').click()}
                    style={{
                      width: '100%', padding: 14, borderRadius: 12, border: '2px dashed var(--sm)',
                      background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                      color: 'var(--ac)', transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.target.style.borderColor = 'var(--ac)'}
                    onMouseLeave={(e) => e.target.style.borderColor = 'var(--sm)'}>
                    📷 Scatta o allega Foto
                  </button>

                  {attachments.length > 0 && (
                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 8 }}>
                      {attachments.map((att, idx) => (
                        <div key={idx} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--sm)' }}>
                          <img src={att.preview} style={{ width: '100%', height: '100%', objectFit: 'cover', aspectRatio: '1' }} alt={`Attachment ${idx}`} />
                          <button type="button" onClick={() => removeAttachment(idx)}
                            style={{
                              position: 'absolute', top: 2, right: 2, width: 20, height: 20,
                              borderRadius: '50%', background: 'var(--rd)', color: 'white',
                              border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {err && <div className="login-msg error" style={{ marginTop: 12 }}>{err}</div>}
              </div>

              <div className="row" style={{ marginTop: 20 }}>
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
  const today = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  const weekdayLabels = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  return (
    <div>
      <div style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--sm)', borderRadius: 8, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ac)' }}>
          📍 Oggi: {today} {new Date(year, month, today).toLocaleDateString('it-IT', { weekday: 'short' })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
        {weekdayLabels.map((label) => (
          <div key={label} style={{
            textAlign: 'center', fontSize: 9, fontWeight: 700,
            color: 'var(--km)', textTransform: 'uppercase',
          }}>{label}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {days.map((day, idx) => {
          const isPast = day && day < today;
          const isToday = day === today;
          const dayValue = day + 6;
          const isSelected = selectedDays.includes(dayValue);

          return day ? (
            <button
              key={idx}
              type="button"
              onClick={() => !isPast && onToggleDay(dayValue)}
              disabled={isPast}
              style={{
                aspectRatio: '1', borderRadius: 4, border: '1.5px solid',
                borderColor: isToday ? 'var(--rd)' : isSelected ? 'var(--k)' : 'var(--sm)',
                background: isSelected ? 'var(--k)' : isToday ? 'var(--rd)22' : 'white',
                color: isSelected ? 'white' : isToday ? 'var(--rd)' : 'var(--k)',
                fontSize: 11, fontWeight: isToday ? 700 : 600,
                cursor: isPast ? 'not-allowed' : 'pointer',
                padding: 0,
                opacity: isPast ? 0.4 : 1,
              }}
            >
              {day}
            </button>
          ) : (
            <div key={idx} />
          );
        })}
      </div>
    </div>
  );
}
