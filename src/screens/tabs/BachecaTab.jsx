import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useT } from '../../lib/i18n.jsx';
import Avatar from '../../components/Avatar.jsx';
import BirthdayReminder from '../../components/BirthdayReminder.jsx';
import AddTaskModal from '../../components/AddTaskModal.jsx';
import TaskDetailModal from '../../components/TaskDetailModal.jsx';

const CAT = { care: '❤️', home: '🏠', health: '💊', admin: '📋', spese: '💶', other: '📌' };

export default function BachecaTab({ familyId, families, tasks, members, taskAssignees = [], me, session, isAll, onChanged }) {
  const allMembers = members; // in HomeScreen ora carichiamo tutti i membri di tutte le famiglie
  const { t } = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [selTask, setSelTask] = useState(null);
  const [openSections, setOpenSections] = useState({ mine: true, all: true, done: false });

  const ST_LABEL = {
    todo: t('section_todo'), taken: 'In carico', done: 'Fatto', to_pay: 'Da pagare',
  };

  // Lista assegnatari per ogni task
  const assigneesForTask = (taskId) => {
    const memberIds = taskAssignees.filter((a) => a.task_id === taskId).map((a) => a.member_id);
    if (memberIds.length === 0) {
      // fallback al campo legacy assigned_to
      const t = tasks.find((x) => x.id === taskId);
      if (t?.assigned_to) {
        const m = members.find((x) => x.id === t.assigned_to);
        return m ? [m] : [];
      }
      return [];
    }
    return memberIds.map((id) => members.find((m) => m.id === id)).filter(Boolean);
  };

  // Un task è "mio" se almeno uno degli assegnatari sono io
  const isMine = (task) => {
    const list = assigneesForTask(task.id);
    return list.some((m) => m.user_id === session.user.id);
  };

  const todos = tasks.filter((task) => task.status !== 'done');
  const dones = tasks.filter((task) => task.status === 'done');
  const myTasks = todos.filter(isMine);
  const otherTasks = todos.filter((t) => !isMine(t));

  const toggleDone = async (e, task) => {
    e.stopPropagation();
    const next = task.status === 'done' ? 'todo' : 'done';
    await supabase.from('tasks').update({ status: next }).eq('id', task.id);
    onChanged();
  };

  const getFamily = (task) => families?.find((f) => f.id === task.family_id);

  const targetFamilyId = familyId || families?.[0]?.id;
  const familyMembers = familyId
    ? members.filter((m) => m.family_id === familyId)
    : members.filter((m) => m.family_id === targetFamilyId);

  const toggle = (k) => setOpenSections((s) => ({ ...s, [k]: !s[k] }));

  const renderTaskList = (list) => (
    <div className="list">
      {list.map((task) => (
        <TaskCard
          key={task.id} task={task}
          family={isAll ? getFamily(task) : null}
          assignees={assigneesForTask(task.id)}
          statusLabel={ST_LABEL[task.status]}
          onClick={() => setSelTask(task)}
          onCheck={(e) => toggleDone(e, task)}
        />
      ))}
    </div>
  );

  if (tasks.length === 0) {
    return (
      <>
        <div className="empty">
          <div className="empty-emoji">📋</div>
          <h3>{t('bacheca_empty_h')}</h3>
          <p>{t('bacheca_empty_p')}</p>
        </div>
        <button className="fab" onClick={() => setShowAdd(true)}>+</button>
        {showAdd && (
          <AddTaskModal familyId={targetFamilyId} families={families} members={allMembers}
            authorMemberId={me?.id}
            onClose={() => setShowAdd(false)}
            onCreated={() => { setShowAdd(false); onChanged(); }} />
        )}
      </>
    );
  }

  return (
    <>
      {/* Reminder di compleanno il giorno prima */}
      <BirthdayReminder members={members} session={session} />

      <div style={{ marginBottom: 24 }}>
        <CollapsibleSection
          label={t('section_mine')}
          count={myTasks.length}
          open={openSections.mine}
          onToggle={() => toggle('mine')}
          empty={t('no_mine_tasks')}
          accent="var(--am)"
          background="var(--am)"
        >
          {myTasks.length > 0 && renderTaskList(myTasks)}
        </CollapsibleSection>
      </div>

      <div style={{ marginTop: 20 }}>
        <CollapsibleSection
          label={t('section_all')}
          count={otherTasks.length}
          open={openSections.all}
          onToggle={() => toggle('all')}
          background="var(--ab)"
        >
          {otherTasks.length > 0 ? renderTaskList(otherTasks) : (
            <p style={{ padding: '0 22px 12px', color: 'var(--km)', fontSize: 13 }}>—</p>
          )}
        </CollapsibleSection>
      </div>

      {dones.length > 0 && (
        <CollapsibleSection
          label={t('section_done_short')}
          count={dones.length}
          open={openSections.done}
          onToggle={() => toggle('done')}
        >
          {renderTaskList(dones)}
        </CollapsibleSection>
      )}

      <button className="fab" onClick={() => setShowAdd(true)}>+</button>

      {showAdd && (
        <AddTaskModal
          familyId={targetFamilyId}
          families={families}
          members={allMembers}
          authorMemberId={me?.id}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); onChanged(); }}
        />
      )}

      {selTask && (
        <TaskDetailModal
          task={selTask}
          members={members}
          me={me}
          onClose={() => setSelTask(null)}
          onChanged={() => { onChanged(); }}
          onClosed={() => setSelTask(null)}
        />
      )}
    </>
  );
}

function CollapsibleSection({ label, count, open, onToggle, children, empty, accent, background }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={onToggle}
        className="collapsible-header"
        style={{
          borderLeft: accent ? `4px solid ${accent}` : '4px solid transparent',
          background: background ? `${background}15` : 'transparent',
          paddingLeft: 16,
        }}
      >
        <span className="collapsible-arrow" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>›</span>
        <span className="collapsible-label" style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        <span className="collapsible-count" style={{ fontWeight: 700, fontSize: 12 }}>{count}</span>
      </button>
      {open && (
        count === 0
          ? <p style={{ padding: '6px 22px 14px', color: 'var(--km)', fontSize: 13 }}>{empty || '—'}</p>
          : children
      )}
    </div>
  );
}

function TaskCard({ task, family, assignees, statusLabel, onClick, onCheck }) {
  return (
    <div
      className={`tc ${task.category} ${task.status === 'done' ? 'done' : ''}`}
      onClick={onClick}
      style={task.urgent ? {
        borderLeft: '6px solid var(--rd)',
        borderRadius: 0,
        background: 'var(--rd)22',
        boxShadow: '0 0 8px rgba(231, 76, 60, 0.3)'
      } : { borderRadius: 8 }}
    >
      <div className="tc-row">
        <button className="tc-check" onClick={onCheck}>
          {task.status === 'done' ? '✓' : '○'}
        </button>
        <span className="tc-emoji">{CAT[task.category] || '📌'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tc-title" style={task.urgent ? { color: 'var(--rd)', fontWeight: 700, fontSize: 14 } : {}}>{task.urgent ? '🚨 ' : ''}{task.title}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
            {assignees.length > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 100,
                background: 'var(--ab)', color: 'var(--ac)',
                fontSize: 11, fontWeight: 600,
              }}>
                {assignees.slice(0, 3).map((a) => (
                  <Avatar
                    key={a.id}
                    name={a.name}
                    avatarUrl={a.avatar_url}
                    avatarLetter={a.avatar_letter}
                    avatarColor={a.avatar_color || '#1C1611'}
                    size={16}
                    style={{ display: 'inline-flex' }}
                  />
                ))}
                {assignees.length === 1 ? assignees[0].name : `${assignees.length}`}
              </span>
            )}
            {family && (
              <span style={{
                padding: '2px 8px', borderRadius: 100,
                background: family.color ? family.color + '22' : 'var(--sm)',
                color: family.color || 'var(--km)',
                fontSize: 11, fontWeight: 600,
              }}>
                {family.emoji} {family.name}
              </span>
            )}
            {task.note && <span className="tc-meta" style={{ marginTop: 0 }}>{task.note}</span>}
            {task.due_date && <span className="tc-meta" style={{ marginTop: 0 }}>📅 {fmtDate(task.due_date)}</span>}
          </div>
        </div>
        <span className={`sp ${task.status}`}>{statusLabel}</span>
      </div>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}