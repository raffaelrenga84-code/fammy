import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useT } from '../../lib/i18n.jsx';
import AddMemberModal from '../../components/AddMemberModal.jsx';
import EditMemberModal from '../../components/EditMemberModal.jsx';
import EditFamilyModal from '../../components/EditFamilyModal.jsx';
import InviteShareModal from '../../components/InviteShareModal.jsx';

export default function FamilyTab({ family, members, session, families, activeFamily, isAll, onSwitchFamily, onNewFamily, onChanged }) {
  const { t } = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editingFamily, setEditingFamily] = useState(false);
  const [invitingMember, setInvitingMember] = useState(null);
  const [showInviteGeneric, setShowInviteGeneric] = useState(false);
  const [openOtherFamilies, setOpenOtherFamilies] = useState(false);
  const [expandedFamilies, setExpandedFamilies] = useState({}); // {familyId: boolean}

  const toggleFamilyExpanded = (familyId) => {
    setExpandedFamilies((prev) => ({ ...prev, [familyId]: !prev[familyId] }));
  };

  const isOwner = family?.created_by === session.user.id;

  const removeMember = async (member) => {
    if (member.user_id === session.user.id) {
      alert('Non puoi rimuovere te stesso da una famiglia.');
      return;
    }
    if (!confirm(`Rimuovere ${member.name} dalla famiglia?`)) return;
    await supabase.from('members').delete().eq('id', member.id);
    onChanged();
  };

  const otherFamilies = (families || []).filter((f) => f.id !== activeFamily);

  // Se isAll è true, mostra tutte le famiglie inline
  if (isAll) {
    return (
      <>
        <div style={{ padding: '0 22px 8px' }}>
          <div className="sh-l" style={{ padding: 0 }}>{t('nav_family')}</div>
        </div>

        {families.map((f) => {
          const familyMembers = members.filter((m) => m.family_id === f.id);
          const isExpanded = expandedFamilies[f.id] || false;
          return (
            <div key={f.id} style={{ marginBottom: 12 }}>
              <button
                onClick={() => toggleFamilyExpanded(f.id)}
                style={{
                  width: '100%', padding: '16px', display: 'flex', alignItems: 'center', gap: 12,
                  background: 'white', border: '1px solid var(--sm)', borderRadius: 12, cursor: 'pointer',
                  textAlign: 'left', transition: 'all 0.2s ease'
                }}>
                <span style={{ fontSize: 24 }}>{f.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--km)' }}>{familyMembers.length} {familyMembers.length === 1 ? 'membro' : 'membri'}</div>
                </div>
                <span style={{
                  fontSize: 20, color: 'var(--km)', transition: 'transform 0.2s ease',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)'
                }}>›</span>
              </button>

              {isExpanded && (
                <div className="list" style={{ marginTop: 8 }}>
                  {familyMembers.map((m) => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      isMe={m.user_id === session.user.id}
                      onEdit={() => setEditingMember(m)}
                      onRemove={() => removeMember(m)}
                      onInvite={() => setInvitingMember(m)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ padding: '8px 16px 16px' }}>
          <button className="btn full secondary" onClick={onNewFamily} style={{ borderStyle: 'dashed' }}>
            {t('new_family_btn')}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ padding: '0 22px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="sh-l" style={{ padding: 0 }}>{t('nav_family')}</div>
        {isOwner && (
          <button className="link-btn" onClick={() => setEditingFamily(true)}>
            ⚙️ {t('edit')}
          </button>
        )}
      </div>

      <div className="list">
        {members.filter(m => m.family_id === family.id).map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            isMe={m.user_id === session.user.id}
            onEdit={() => setEditingMember(m)}
            onRemove={() => removeMember(m)}
            onInvite={() => setInvitingMember(m)}
          />
        ))}
      </div>

      <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn full secondary" onClick={() => setShowAdd(true)}>
          + {t('addmember_h')}
        </button>
        <button className="btn full" onClick={() => setShowInviteGeneric(true)}>
          {t('family_invite_link')}
        </button>
      </div>

      {/* Sezione "Altre tue famiglie" + Crea nuova famiglia, collassata */}
      <div style={{ marginTop: 8 }}>
        <button onClick={() => setOpenOtherFamilies(!openOtherFamilies)} className="collapsible-header">
          <span className="collapsible-arrow" style={{ transform: openOtherFamilies ? 'rotate(90deg)' : 'rotate(0)' }}>›</span>
          <span className="collapsible-label">{t('families_other')}</span>
          <span className="collapsible-count">{otherFamilies.length}</span>
        </button>

        {openOtherFamilies && (
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {otherFamilies.length > 0 && otherFamilies.map((f) => (
              <button key={f.id} onClick={() => onSwitchFamily(f.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 14,
                  background: 'white', border: '1px solid var(--sm)', borderRadius: 14,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                <span style={{ fontSize: 24 }}>{f.emoji}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{f.name}</span>
                <span style={{ color: 'var(--kl)', fontSize: 18 }}>›</span>
              </button>
            ))}
            <button className="btn full secondary" onClick={onNewFamily}
              style={{ borderStyle: 'dashed' }}>
              {t('new_family_btn')}
            </button>
          </div>
        )}
      </div>

      {showAdd && (
        <AddMemberModal
          familyId={family.id}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); onChanged(); }}
        />
      )}

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSaved={() => { setEditingMember(null); onChanged(); }}
        />
      )}

      {editingFamily && (
        <EditFamilyModal
          family={family}
          onClose={() => setEditingFamily(false)}
          onSaved={() => { setEditingFamily(false); onChanged(); }}
          onDeleted={() => { setEditingFamily(false); onChanged(); }}
        />
      )}

      {invitingMember && (
        <InviteShareModal
          familyId={family.id}
          familyName={family.name}
          member={invitingMember}
          session={session}
          onClose={() => setInvitingMember(null)}
        />
      )}

      {showInviteGeneric && (
        <InviteShareModal
          familyId={family.id}
          familyName={family.name}
          member={null}
          session={session}
          onClose={() => setShowInviteGeneric(false)}
        />
      )}
    </>
  );
}

function MemberCard({ member, isMe, onEdit, onRemove, onInvite }) {
  const canInvite = !isMe && !member.user_id;

  return (
    <div className="member-card" onClick={onEdit}>
      <div className="av" style={{ background: member.avatar_color || '#1C1611' }}>
        {member.avatar_letter || member.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          {member.name}
          {isMe && <span style={{ fontSize: 11, color: 'var(--km)', fontWeight: 500 }}>(tu)</span>}
        </div>
        <div style={{ color: 'var(--km)', fontSize: 13 }}>
          {member.role || 'membro'}
          {member.user_id ? ' · ✓ ha account' : ' · senza account'}
        </div>
      </div>
      {canInvite && (
        <button
          onClick={(e) => { e.stopPropagation(); onInvite(); }}
          style={{
            background: 'var(--ab)', border: 'none', color: 'var(--ac)', fontSize: 12,
            fontWeight: 600, padding: '6px 10px', borderRadius: 100,
          }}
          title="Invita via link">
          💌
        </button>
      )}
      {!isMe && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ background: 'none', border: 'none', color: 'var(--rd)', fontSize: 18, padding: 8 }}
          title="Rimuovi">
          ✕
        </button>
      )}
    </div>
  );
}
