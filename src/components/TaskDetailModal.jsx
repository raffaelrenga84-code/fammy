import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const CAT = [
  { id: 'care',   emoji: '❤️', label: 'Cura' },
  { id: 'home',   emoji: '🏠', label: 'Casa' },
  { id: 'health', emoji: '💊', label: 'Salute' },
  { id: 'admin',  emoji: '📋', label: 'Burocrazia' },
  { id: 'spese',  emoji: '💶', label: 'Spese' },
  { id: 'other',  emoji: '📌', label: 'Altro' },
];

// Solo 3 stati cliccabili. 'taken' viene impostato automaticamente
// quando si fa "Me ne occupo io".
const STATUS = [
  { id: 'todo',   label: 'Da fare', color: 'var(--am)' },
  { id: 'done',   label: 'Fatto', color: 'var(--gn)' },
  { id: 'to_pay', label: 'Da pagare', color: 'var(--rd)' },
];

export default function TaskDetailModal({
  task, members, me,
  onClose, onChanged, onClosed,
  onEdit,              // (task) => void  -> apre AddTaskModal in edit mode
  onOpenExpense,       // (task) => void  -> switch a Spese + apri spesa per task
}) {
  const [title] = useState(task.title);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showDelegate, setShowDelegate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: commentsData } = await supabase
        .from('task_responses').select('*')
        .eq('task_id', task.id).order('created_at');
      if (!cancelled) setComments(commentsData || []);

      const { data: assigneeData } = await supabase
        .from('task_assignees').select('member_id').eq('task_id', task.id);
      if (!cancelled) {
        const memberIds = (assigneeData || []).map((a) => a.member_id);
        setAssignees(members.filter((m) => memberIds.includes(m.id)));
      }
    })();
    return () => { cancelled = true; };
  }, [task.id, members]);

  // Cambio stato: chiude il modale automaticamente
  const updateStatus = async (s) => {
    setBusy(true);
    await supabase.from('tasks').update({ status: s }).eq('id', task.id);
    setBusy(false);
    onChanged();
    if (s === 'to_pay' && typeof onOpenExpense === 'function') {
      onOpenExpense(task);
    }
    onClosed();
  };

  const canDelete = !task.author_id || task.author_id === me?.id;
  const isRecurring = !!(task.recurring_days && task.recurring_days.length > 0);

  const requestRemove = () => {
    if (isRecurring) { setShowDeleteConfirm(true); return; }
    if (!confirm('Eliminare questo incarico? Verrà cancellato anche dal database.')) return;
    doDeleteAll();
  };

  const doDeleteAll = async () => {
    setBusy(true);
    await supabase.from('tasks').delete().eq('id', task.id);
    setBusy(false); setShowDeleteConfirm(false);
    onChanged(); onClosed();
  };

  const doStopRecurrence = async () => {
    setBusy(true);
    await supabase.from('tasks').update({
      recurring_days: null, recurring_until: null,
    }).eq('id', task.id);
    await supabase.from('task_responses').insert({
      task_id: task.id, author_id: me?.id || null,
      text: 'Ho terminato le ricorrenze future di questo incarico',
      type: 'system',
    });
    setBusy(false); setShowDeleteConfirm(false);
    onChanged(); onClosed();
  };

  const isAssigned = assignees.some((a) => a.id === me?.id);
  const isSoleAssignee = isAssigned && assignees.length === 1;
  const isCoAssignee = isAssigned && assignees.length > 1;
  const isDelegateTarget = !!(task.delegated_to && me && task.delegated_to === me.id);

  const claimOnly = async () => {
    if (!me) return;
    setBusy(true);
    const snapshot = (task.delegated_from && task.delegated_from.length > 0)
      ? task.delegated_from
      : assignees.map((a) => a.id);

    await supabase.from('task_assignees').delete().eq('task_id', task.id);
    await supabase.from('task_assignees').insert({ task_id: task.id, member_id: me.id });
    await supabase.from('tasks').update({
      status: 'taken', urgent: false, priority: 'normal',
      delegated_from: snapshot, delegated_to: null,
    }).eq('id', task.id);
    await supabase.from('task_responses').insert({
      task_id: task.id, author_id: me.id,
      text: 'Me ne occupo io ✓', type: 'system',
    });
    setBusy(false); onChanged(); onClosed();
  };

  const delegateToMember = async (memberId) => {
    if (!me) return;
    setBusy(true);
    const baseGroup = (task.delegated_from && task.delegated_from.length > 0)
      ? task.delegated_from
      : assignees.map((a) => a.id);
    const restoreIds = baseGroup.filter((id) => id !== me.id);
    if (memberId && !restoreIds.includes(memberId)) restoreIds.push(memberId);

    await supabase.from('task_assignees').delete().eq('task_id', task.id);
    if (restoreIds.length > 0) {
      await supabase.from('task_assignees').insert(
        restoreIds.map((mid) => ({ task_id: task.id, member_id: mid }))
      );
    }
    await supabase.from('tasks').update({
      status: restoreIds.length === 0 ? 'todo' : 'taken',
      urgent: false, priority: 'medium',
      delegated_to: memberId, delegated_from: baseGroup,
    }).eq('id', task.id);

    const member = members.find((m) => m.id === memberId);
    await supabase.from('task_responses').insert({
      task_id: task.id, author_id: me.id,
      text: `Ho chiesto a @${member?.name || 'Qualcuno'} di occuparsene`,
      type: 'system',
    });
    setBusy(false); setShowDelegate(false);
    onChanged(); onClosed();
  };

  const refuseDelegation = async () => {
    if (!me) return;
    setBusy(true);
    await supabase.from('tasks').update({
      delegated_to: null, priority: 'normal',
    }).eq('id', task.id);
    await supabase.from('task_responses').insert({
      task_id: task.id, author_id: me.id,
      text: 'No, non posso occuparmene ora', type: 'system',
    });
    setBusy(false); onChanged(); onClosed();
  };

  const unassignMe = async () => {
    if (!me) return;
    setBusy(true);
    await supabase.from('task_assignees').delete().eq('task_id', task.id);

    let restoreIds = [];
    if (task.delegated_from && task.delegated_from.length > 0) {
      restoreIds = task.delegated_from.filter((id) => id !== me.id);
    } else {
      restoreIds = assignees.filter((a) => a.id !== me.id).map((a) => a.id);
    }

    if (restoreIds.length > 0) {
      await supabase.from('task_assignees').insert(
        restoreIds.map((mid) => ({ task_id: task.id, member_id: mid }))
      );
    }

    await supabase.from('task_responses').insert({
      task_id: task.id, author_id: me.id,
      text: 'Ho un imprevisto — delego', type: 'system',
    });

    await supabase.from('tasks').update({
      status: restoreIds.length === 0 ? 'todo' : 'taken',
      urgent: true, priority: 'high',
      delegated_from: null, delegated_to: null,
    }).eq('id', task.id);

    setBusy(false); onChanged(); onClosed();
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    setBusy(true);
    await supabase.from('task_responses').insert({
      task_id: task.id, author_id: me?.id || null,
      text: newComment.trim(), type: 'comment',
    });
    setNewComment('');
    const { data } = await supabase.from('task_responses').select('*').eq('task_id', task.id).order('created_at');
    setComments(data || []);
    setBusy(false);
  };

  const otherMembers = members.filter((m) => m.id !== me?.id);
  const hasOriginalGroup = task.delegated_from && task.delegated_from.length > 1;

  return (
    <div className="modal-bg" onClick={onClose}>
      {showDeleteConfirm && (
        <div onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 16,
          }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 14, maxWidth: 360, width: '100%',
              padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🗑️</div>
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>Eliminare un incarico ricorrente</h3>
            <p style={{ fontSize: 13, color: 'var(--km)', marginTop: 0 }}>
              Questo incarico ha delle <strong>ricorrenze future</strong>. Cosa vuoi fare?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <button onClick={doStopRecurrence} disabled={busy}
                style={{
                  padding: '12px 14px', borderRadius: 12,
                  border: '1.5px solid var(--ac)', background: 'white',
                  color: 'var(--ac)', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                🛑 Termina solo le ricorrenze
                <div style={{ fontSize: 11, color: 'var(--km)', fontWeight: 500, marginTop: 2 }}>
                  Mantieni il task storico nella sua data originale, niente più ripetizioni.
                </div>
              </button>
              <button onClick={doDeleteAll} disabled={busy}
                style={{
                  padding: '12px 14px', borderRadius: 12,
                  border: '1.5px solid var(--rd)', background: 'var(--rdB)',
                  color: 'var(--rd)', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                🗑️ Elimina tutto (incluse ricorrenze)
                <div style={{ fontSize: 11, color: 'var(--km)', fontWeight: 500, marginTop: 2 }}>
                  Cancella il task dal database. Operazione irreversibile.
                </div>
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} disabled={busy}
                style={{
                  padding: '10px 14px', borderRadius: 12,
                  border: '1.5px solid var(--sm)', background: 'white',
                  color: 'var(--km)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', marginTop: 4,
                }}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 32 }}>{CAT.find((c) => c.id === task.category)?.emoji}</span>
          <h2 style={{ flex: 1 }}>{title}</h2>
        </div>
        {task.note && <p className="modal-sub">{task.note}</p>}
        {task.due_date && (
          <p className="modal-sub">
            📅 {new Date(task.due_date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        )}

        {isDelegateTarget && (
          <div style={{
            marginTop: 12, padding: '12px 14px',
            background: '#FFF3E0', border: '1.5px solid #F39C12',
            borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#B36E00',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>🧡</span>
            <span style={{ flex: 1 }}>
              Ti hanno chiesto: "Lo fai tu?" — accetta se puoi, altrimenti torna a tutti.
            </span>
          </div>
        )}

        {assignees.length > 0 && (
          <div style={{
            marginTop: 12, padding: 10, background: 'var(--ab)',
            borderRadius: 12, fontSize: 13,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ac)', marginBottom: 6, textTransform: 'uppercase' }}>
              👥 Assegnato a {assignees.length === 1 ? '' : `(${assignees.length})`}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {assignees.map((a) => {
                const isDelegated = task.delegated_to && a.id === task.delegated_to;
                return (
                  <span key={a.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px',
                    background: isDelegated ? '#F39C1222' : 'white',
                    border: `1px solid ${isDelegated ? '#F39C12' : 'var(--sm)'}`,
                    borderRadius: 100,
                    fontSize: 12, fontWeight: 600,
                    color: isDelegated ? '#B36E00' : 'inherit',
                  }}>
                    <MiniAvatar member={a} />
                    {a.name}
                    {isDelegated && <span title="Delegato">🧡</span>}
                  </span>
                );
              })}
            </div>
            {hasOriginalGroup && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--km)', fontStyle: 'italic' }}>
                📌 Originalmente su {task.delegated_from.length} persone — al "Ho un imprevisto" tornerà a tutti.
              </div>
            )}
          </div>
        )}

        {/* Azioni di assegnazione */}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isDelegateTarget && (
            <>
              <button onClick={claimOnly} disabled={busy} style={primaryBtnStyle(busy)}>
                ✋ Me ne occupo io
              </button>
              <button onClick={refuseDelegation} disabled={busy} style={secondaryBtnStyle(busy)}>
                🙅 No, non posso ora — torna al gruppo
              </button>
            </>
          )}

          {!isAssigned && !isDelegateTarget && (
            <>
              <button onClick={claimOnly} disabled={busy} style={primaryBtnStyle(busy)}>
                ✋ Me ne occupo io
              </button>
              {otherMembers.length > 0 && (
                <AssignGrid title="👤 Chiedi a qualcuno: Lo fai tu?" members={otherMembers} onPick={delegateToMember} busy={busy} />
              )}
            </>
          )}

          {/* Co-assegnatario: SOLO 'Me ne occupo io'. L'imprevisto compare solo dopo aver claimato. */}
          {isCoAssignee && !isDelegateTarget && (
            <>
              <button onClick={claimOnly} disabled={busy} style={primaryBtnStyle(busy)}>
                ✋ Me ne occupo io (rendilo solo mio)
              </button>
              <div style={{
                padding: '10px 14px', background: 'var(--ab)',
                border: '1px solid var(--sm)', borderRadius: 12,
                fontSize: 12, color: 'var(--km)', textAlign: 'center',
              }}>
                Sei tra i {assignees.length} responsabili. Chiunque tra voi può completarlo.
              </div>
            </>
          )}

          {isSoleAssignee && !isDelegateTarget && (
            <>
              <div style={{
                padding: '12px 16px', background: 'var(--gnB)',
                border: '1.5px solid var(--gn)', borderRadius: 12,
                fontSize: 13, color: 'var(--gn)', fontWeight: 600, textAlign: 'center',
              }}>
                ✓ Sei tu il responsabile
              </div>
              <button onClick={unassignMe} disabled={busy} style={dangerBtnStyle(busy)}>
                🚨 Ho un imprevisto {hasOriginalGroup ? '— rimette in bacheca a tutti' : '— delego'}
              </button>
              <button
                onClick={() => setShowDelegate((v) => !v)}
                disabled={busy}
                style={{
                  padding: '10px 14px', borderRadius: 12, border: '1.5px solid var(--ac)',
                  background: 'white', color: 'var(--ac)', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                👥 {showDelegate ? 'Annulla' : 'Lo fai tu? — chiedi a qualcuno (non obbligo)'}
              </button>
              {showDelegate && otherMembers.length > 0 && (
                <AssignGrid title="👤 Chiedi a:" members={otherMembers} onPick={delegateToMember} busy={busy} />
              )}
            </>
          )}
        </div>

        {/* Commenti */}
        <div style={{ marginTop: 24 }}>
          <label>Commenti ({comments.length})</label>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
            {comments.length === 0 && <p style={{ color: 'var(--km)', fontSize: 13 }}>Nessun commento ancora.</p>}
            {comments.map((c) => {
              const author = members.find((m) => m.id === c.author_id);
              return (
                <div key={c.id} className="card" style={{ marginBottom: 6, padding: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--km)', marginBottom: 2 }}>
                    <strong>{author?.name || 'Qualcuno'}</strong> · {new Date(c.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontSize: 14 }}>{c.text}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Scrivi un commento…"
              value={newComment} onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addComment(); }} />
            <button className="btn" onClick={addComment} disabled={busy || !newComment.trim()}>Invia</button>
          </div>
        </div>

        {/* Stato — sotto i commenti. Click = chiude il modale */}
        <div style={{ marginTop: 20 }}>
          <label>Stato</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STATUS.map((s) => (
              <button key={s.id} type="button" onClick={() => updateStatus(s.id)} disabled={busy}
                style={{
                  padding: '10px 16px', borderRadius: 100, border: '1.5px solid',
                  borderColor: task.status === s.id ? s.color : 'var(--sm)',
                  background: task.status === s.id ? s.color : 'white',
                  color: task.status === s.id ? 'white' : 'var(--k)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>{s.label}</button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--km)', marginTop: 6 }}>
            Cliccando uno stato, l'incarico viene aggiornato e la finestra si chiude.
          </p>
        </div>

        <div className="row" style={{ marginTop: 24 }}>
          <button className="btn secondary" onClick={onClose}>Chiudi</button>
          <button className="btn secondary" onClick={() => { onClosed(); if (typeof onEdit === 'function') onEdit(task); }}>
            Modifica
          </button>
          {canDelete && (
            <button className="btn danger" onClick={requestRemove} disabled={busy}>Elimina</button>
          )}
        </div>
      </div>
    </div>
  );
}

function primaryBtnStyle(busy) {
  return {
    padding: '12px 16px', borderRadius: 12, border: 'none',
    background: 'var(--tc)', color: 'white',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, opacity: busy ? 0.6 : 1,
  };
}

function secondaryBtnStyle(busy) {
  return {
    padding: '12px 16px', borderRadius: 12,
    border: '1.5px solid var(--sm)', background: 'white',
    color: 'var(--km)', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', opacity: busy ? 0.6 : 1,
  };
}

function dangerBtnStyle(busy) {
  return {
    padding: '12px 16px', borderRadius: 12,
    border: '1.5px solid #F5C6C3', background: 'var(--rdB)',
    color: 'var(--rd)', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', opacity: busy ? 0.6 : 1,
  };
}

function MiniAvatar({ member }) {
  return (
    <span style={{
      width: 18, height: 18, borderRadius: 5,
      background: member.avatar_color || '#1C1611',
      color: 'white', fontSize: 10, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>{member.avatar_letter || (member.name || '?').charAt(0).toUpperCase()}</span>
  );
}

function AssignGrid({ title, members, onPick, busy }) {
  return (
    <div style={{
      background: 'var(--ab)', border: '1.5px solid #B5D4F4',
      borderRadius: 12, padding: 12,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--ac)',
        letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10,
      }}>{title}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {members.slice(0, 8).map((m) => (
          <button key={m.id} onClick={() => onPick(m.id)} disabled={busy}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 6, padding: '10px 12px', background: 'white',
              border: '1.5px solid var(--sm)', borderRadius: 12,
              cursor: 'pointer', opacity: busy ? 0.6 : 1,
            }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: m.avatar_color || '#1C1611', color: 'white',
              fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{m.avatar_letter || (m.name || '?').charAt(0).toUpperCase()}</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--k)' }}>
              {(m.name || '').split(' ')[0]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
