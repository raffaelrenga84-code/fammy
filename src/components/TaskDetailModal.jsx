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
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  // Carica commenti e assegnati
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Carica commenti
      const { data: commentsData } = await supabase
        .from('task_responses')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at');
      if (!cancelled) setComments(commentsData || []);

      // Carica assignee
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

  const remove = async () => {
    if (!confirm('Eliminare questo incarico? Verrà cancellato anche dal database.')) return;
    setBusy(true);
    await supabase.from('tasks').delete().eq('id', task.id);
    onChanged();
    onClosed();
  };

  // Verifica se io sono uno degli assignee
  const isMineTask = assignees.some((a) => a.id === me?.id);

  // Assegna a me stesso
  const assignToMe = async () => {
    if (!me) return;
    setBusy(true);
    // Inserisci me in task_assignees
    await supabase.from('task_assignees').insert({
      task_id: task.id,
      member_id: me.id,
    });
    // Aggiungi una risposta automatica
    await supabase.from('task_responses').insert({
      task_id: task.id,
      author_id: me.id,
      text: 'Me ne occupo io ✓',
      type: 'system',
    });
    // Cambia status a taken
    await supabase.from('tasks').update({ status: 'taken' }).eq('id', task.id);
    setBusy(false);
    onChanged();
    onClosed();
  };

  // Assegna a un membro specifico
  const assignToMember = async (memberId) => {
    setBusy(true);
    // Inserisci il membro in task_assignees
    await supabase.from('task_assignees').insert({
      task_id: task.id,
      member_id: memberId,
    });
    // Aggiungi una risposta automatica
    const member = members.find((m) => m.id === memberId);
    await supabase.from('task_responses').insert({
      task_id: task.id,
      author_id: me?.id || null,
      text: `Ho assegnato a @${member?.name || 'Qualcuno'}`,
      type: 'system',
    });
    // Cambia status a taken
    await supabase.from('tasks').update({ status: 'taken' }).eq('id', task.id);
    setBusy(false);
    setShowAssignMenu(false);
    onChanged();
    onClosed();
  };

  // Rimuovi me stesso (Ho un imprevisto)
  const unassignMe = async () => {
    if (!me) return;
    setBusy(true);
    // Rimuovi me da task_assignees
    await supabase
      .from('task_assignees')
      .delete()
      .eq('task_id', task.id)
      .eq('member_id', me.id);
    // Aggiungi una risposta automatica
    await supabase.from('task_responses').insert({
      task_id: task.id,
      author_id: me.id,
      text: 'Ho un imprevisto — delego',
      type: 'system',
    });
    // Se non ci sono altri assignee, cambia status a todo e marca come urgent
    const remaining = assignees.filter((a) => a.id !== me.id);
    if (remaining.length === 0) {
      await supabase.from('tasks').update({ status: 'todo', urgent: true }).eq('id', task.id);
    } else {
      // Anche se ci sono altri assignee, marca come urgent
      await supabase.from('tasks').update({ urgent: true }).eq('id', task.id);
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

            {/* AZIONI RAPIDE */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!isMineTask ? (
                <>
                  {/* Se NON sono assegnato: mostra "Me ne occupo io" */}
                  <button
                    onClick={assignToMe}
                    disabled={busy}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'var(--tc)',
                      color: 'white',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    ✋ Me ne occupo io
                  </button>

                  {/* Assegna a griglia di avatar */}
                  <div style={{
                    background: 'var(--ab)',
                    border: '1.5px solid #B5D4F4',
                    borderRadius: 12,
                    padding: 12,
                  }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--ac)',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      marginBottom: 10,
                    }}>
                      👤 Assegna a
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {members
                        .filter((m) => m.id !== me?.id)
                        .slice(0, 5)
                        .map((m) => (
                          <button
                            key={m.id}
                            onClick={() => assignToMember(m.id)}
                            disabled={busy}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 6,
                              padding: '10px 12px',
                              background: 'white',
                              border: '1.5px solid var(--sm)',
                              borderRadius: 12,
                              cursor: 'pointer',
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 8,
                                background: m.avatar_color || '#1C1611',
                                color: 'white',
                                fontSize: 13,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {m.avatar_letter || m.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--k)' }}>
                              {m.name.split(' ')[0]}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Se SONO assegnato: mostra "Ho un imprevisto" */}
                  <button
                    onClick={unassignMe}
                    disabled={busy}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: '1.5px solid #F5C6C3',
                      background: 'var(--rdB)',
                      color: 'var(--rd)',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    🚨 Ho un imprevisto — delego
                  </button>
                  {/* Status read-only */}
                  <div style={{
                    padding: '12px 16px',
                    background: 'var(--gnB)',
                    border: '1.5px solid var(--gn)',
                    borderRadius: 12,
                    fontSize: 13,
                    color: 'var(--gn)',
                    fontWeight: 600,
                    textAlign: 'center',
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
              <button className="btn danger" onClick={remove} disabled={busy}>Elimina</button>
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