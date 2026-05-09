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

const STATUS = [
  { id: 'todo',   label: 'Da fare', color: 'var(--am)' },
  { id: 'taken',  label: 'In carico', color: 'var(--ac)' },
  { id: 'done',   label: 'Fatto', color: 'var(--gn)' },
  { id: 'to_pay', label: 'Da pagare', color: 'var(--rd)' },
];

export default function TaskDetailModal({ task, members, me, onClose, onChanged, onClosed }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note || '');
  const [category, setCategory] = useState(task.category);
  const [status, setStatus] = useState(task.status);
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: commentsData } = await supabase
        .from('task_responses')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at');
      if (!cancelled) setComments(commentsData || []);

      const { data: assigneeData } = await supabase
        .from('task_assignees')
        .select('member_id')
        .eq('task_id', task.id);
      if (!cancelled) {
        const memberIds = (assigneeData || []).map((a) => a.member_id);
        const assignedMembers = members.filter((m) => memberIds.includes(m.id));
        setAssignees(assignedMembers);
      }
    })();
    return () => { cancelled = true; };
  }, [task.id, members]);

  const save = async () => {
    setBusy(true);
    await supabase.from('tasks').update({
      title: title.trim(),
      note: note.trim() || null,
      category,
      status,
      due_date: dueDate || null,
    }).eq('id', task.id);
    setBusy(false);
    setEditing(false);
    onChanged();
  };

  const updateStatus = async (s) => {
    setStatus(s);
    await supabase.from('tasks').update({ status: s }).eq('id', task.id);
    onChanged();
  };

  // Solo il creatore può eliminare
  const canDelete = !task.author_id || task.author_id === me?.id;

  const remove = async () => {
    if (!confirm('Eliminare questo incarico? Verrà cancellato anche dal database.')) return;
    setBusy(true);
    await supabase.from('tasks').delete().eq('id', task.id);
    onChanged();
    onClosed();
  };

  // Stato assegnazione
  const isAssigned = assignees.some((a) => a.id === me?.id);
  const isSoleAssignee = isAssigned && assignees.length === 1;
  const isCoAssignee = isAssigned && assignees.length > 1;

  // CLAIM solo per me: cancella tutti gli altri assignee e tieni solo me
  const claimOnly = async () => {
    if (!me) return;
    setBusy(true);
    // Cancella TUTTI gli assignee esistenti
    await supabase.from('task_assignees').delete().eq('task_id', task.id);
    // Inserisci solo me
    await supabase.from('task_assignees').insert({ task_id: task.id, member_id: me.id });
    // Reset urgenza, status -> taken, priority -> normal
    await supabase.from('tasks').update({
      status: 'taken',
      urgent: false,
      priority: 'normal',
    }).eq('id', task.id);
    // Risposta automatica
    await supabase.from('task_responses').insert({
      task_id: task.id,
      author_id: me.id,
      text: 'Me ne occupo io ✓',
      type: 'system',
    });
    setBusy(false);
    onChanged();
    onClosed();
  };

  // Assegna a un membro specifico (sostituendo tutti gli altri)
  const assignToMember = async (memberId) => {
    setBusy(true);
    await supabase.from('task_assignees').delete().eq('task_id', task.id);
    await supabase.from('task_assignees').insert({ task_id: task.id, member_id: memberId });
    await supabase.from('tasks').update({
      status: 'taken',
      urgent: false,
      priority: 'normal',
    }).eq('id', task.id);
    const member = members.find((m) => m.id === memberId);
    await supabase.from('task_responses').insert({
      task_id: task.id,
      author_id: me?.id || null,
      text: `Ho assegnato a @${member?.name || 'Qualcuno'}`,
      type: 'system',
    });
    setBusy(false);
    onChanged();
    onClosed();
  };

  // Rimuovi me (Ho un imprevisto): mantiene gli altri assignee, marca priority='high'
  const unassignMe = async () => {
    if (!me) return;
    setBusy(true);
    await supabase.from('task_assignees').delete().eq('task_id', task.id).eq('member_id', me.id);
    await supabase.from('task_responses').insert({
      task_id: task.id,
      author_id: me.id,
      text: 'Ho un imprevisto — delego',
      type: 'system',
    });
    const remaining = assignees.filter((a) => a.id !== me.id);
    if (remaining.length === 0) {
      // Nessun altro: torna a todo + priority high
      await supabase.from('tasks').update({
        status: 'todo',
        urgent: true,
        priority: 'high',
      }).eq('id', task.id);
    } else {
      // Restano altri assignee: gli appare urgente
      await supabase.from('tasks').update({
        urgent: true,
        priority: 'high',
      }).eq('id', task.id);
    }
    setBusy(false);
    onChanged();
    onClosed();
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    setBusy(true);
    await supabase.from('task_responses').insert({
      task_id: task.id,
      author_id: me?.id || null,
      text: newComment.trim(),
      type: 'comment',
    });
    setNewComment('');
    const { data } = await supabase.from('task_responses').select('*').eq('task_id', task.id).order('created_at');
    setComments(data || []);
    setBusy(false);
  };

  const otherMembers = members.filter((m) => m.id !== me?.id);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!editing ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 32 }}>{CAT.find((c) => c.id === task.category)?.emoji}</span>
              <h2 style={{ flex: 1 }}>{title}</h2>
            </div>
            {note && <p className="modal-sub">{note}</p>}
            {dueDate && <p className="modal-sub">📅 {new Date(dueDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>}

            {/* Mostra elenco assegnatari */}
            {assignees.length > 0 && (
              <div style={{
                marginTop: 12, padding: 10, background: 'var(--ab)',
                borderRadius: 12, fontSize: 13,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ac)', marginBottom: 6, textTransform: 'uppercase' }}>
                  👥 Assegnato a {assignees.length === 1 ? '' : `(${assignees.length})`}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {assignees.map((a) => (
                    <span key={a.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', background: 'white',
                      border: '1px solid var(--sm)', borderRadius: 100,
                      fontSize: 12, fontWeight: 600,
                    }}>
                      <MiniAvatar member={a} />
                      {a.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AZIONI RAPIDE */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!isAssigned && (
                <>
                  <button
                    onClick={claimOnly}
                    disabled={busy}
                    style={primaryBtnStyle(busy)}
                  >
                    ✋ Me ne occupo io
                  </button>
                  {otherMembers.length > 0 && (
                    <AssignGrid members={otherMembers} onPick={assignToMember} busy={busy} />
                  )}
                </>
              )}

              {isCoAssignee && (
                <>
                  <button
                    onClick={claimOnly}
                    disabled={busy}
                    style={primaryBtnStyle(busy)}
                  >
                    ✋ Me ne occupo io (rendilo solo mio)
                  </button>
                  <button
                    onClick={unassignMe}
                    disabled={busy}
                    style={dangerBtnStyle(busy)}
                  >
                    🚨 Ho un imprevisto — delego
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

              {isSoleAssignee && (
                <>
                  <button
                    onClick={unassignMe}
                    disabled={busy}
                    style={dangerBtnStyle(busy)}
                  >
                    🚨 Ho un imprevisto — delego
                  </button>
                  <div style={{
                    padding: '12px 16px', background: 'var(--gnB)',
                    border: '1.5px solid var(--gn)', borderRadius: 12,
                    fontSize: 13, color: 'var(--gn)', fontWeight: 600, textAlign: 'center',
                  }}>
                    ✓ Sei tu il responsabile
                  </div>
                </>
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <label>Stato</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {STATUS.map((s) => (
                  <button key={s.id} type="button" onClick={() => updateStatus(s.id)}
                    style={{
                      padding: '8px 14px', borderRadius: 100, border: '1.5px solid',
                      borderColor: status === s.id ? s.color : 'var(--sm)',
                      background: status === s.id ? s.color : 'white',
                      color: status === s.id ? 'white' : 'var(--k)',
                      fontSize: 12, fontWeight: 600,
                    }}>{s.label}</button>
                ))}
              </div>
            </div>

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

            <div className="row" style={{ marginTop: 24 }}>
              <button className="btn secondary" onClick={onClose}>Chiudi</button>
              <button className="btn secondary" onClick={() => setEditing(true)}>Modifica</button>
              {canDelete && (
                <button className="btn danger" onClick={remove} disabled={busy}>Elimina</button>
              )}
            </div>
          </>
        ) : (
          <>
            <h2>Modifica incarico</h2>

            <label>Titolo</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />

            <div style={{ marginTop: 16 }}>
              <label>Categoria</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CAT.map((c) => (
                  <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                    style={{
                      padding: '8px 14px', borderRadius: 100, border: '1.5px solid',
                      borderColor: category === c.id ? 'var(--k)' : 'var(--sm)',
                      background: category === c.id ? 'var(--sm)' : 'white',
                      fontSize: 13, fontWeight: 600,
                    }}>{c.emoji} {c.label}</button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label>Quando?</label>
              <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            <div style={{ marginTop: 16 }}>
              <label>Nota</label>
              <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="row" style={{ marginTop: 20 }}>
              <button className="btn secondary" onClick={() => setEditing(false)}>Annulla</button>
              <button className="btn" onClick={save} disabled={busy}>{busy ? <span className="spin" /> : 'Salva'}</button>
            </div>
          </>
        )}
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

function AssignGrid({ members, onPick, busy }) {
  return (
    <div style={{
      background: 'var(--ab)', border: '1.5px solid #B5D4F4',
      borderRadius: 12, padding: 12,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--ac)',
        letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10,
      }}>
        👤 Assegna a
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {members.slice(0, 6).map((m) => (
          <button
            key={m.id}
            onClick={() => onPick(m.id)}
            disabled={busy}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 6, padding: '10px 12px', background: 'white',
              border: '1.5px solid var(--sm)', borderRadius: 12,
              cursor: 'pointer', opacity: busy ? 0.6 : 1,
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: m.avatar_color || '#1C1611', color: 'white',
              fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {m.avatar_letter || (m.name || '?').charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--k)' }}>
              {(m.name || '').split(' ')[0]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
