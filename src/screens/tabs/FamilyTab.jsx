import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useT } from '../../lib/i18n.jsx';
import Avatar from '../../components/Avatar.jsx';
import AddMemberModal from '../../components/AddMemberModal.jsx';
import EditMemberModal from '../../components/EditMemberModal.jsx';
import EditFamilyModal from '../../components/EditFamilyModal.jsx';
import FamilyInviteModal from '../../components/FamilyInviteModal.jsx';

export default function FamilyTab({ family, members, session, families, activeFamily, isAll, onSwitchFamily, onNewFamily, onChanged }) {
  const { t } = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editingFamily, setEditingFamily] = useState(false);
  const [showFamilyInvite, setShowFamilyInvite] = useState(false);
  const [openOtherFamilies, setOpenOtherFamilies] = useState(false);
  const [expandedFamilies, setExpandedFamilies] = useState({}); // {familyId: boolean}
  const [inviteMenuOpen, setInviteMenuOpen] = useState(null); // familyId che ha il menu aperto

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
          const inviteOpen = inviteMenuOpen === f.id;
          return (
            <div key={f.id} style={{ marginBottom: 12, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: inviteOpen ? 8 : 0 }}>
                <button
                  onClick={() => toggleFamilyExpanded(f.id)}
                  style={{
                    flex: 1, padding: '16px', display: 'flex', alignItems: 'center', gap: 12,
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
                <button
                  onClick={(e) => { e.stopPropagation(); setInviteMenuOpen(inviteOpen ? null : f.id); }}
                  style={{
                    padding: '10px 12px', background: 'white', border: '1px solid var(--sm)',
                    borderRadius: 12, cursor: 'pointer', fontSize: 18, color: 'var(--ac)',
                  }}
                  title="Invita">
                  💌
                </button>
              </div>

              {/* Menu invito dropdown */}
              {inviteOpen && (
                <div style={{
                  background: 'white', border: '1px solid var(--sm)', borderRadius: 12, padding: 12,
                  marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--km)', textTransform: 'uppercase' }}>
                    Condividi invito
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/invite/${f.invite_token || 'temp'}`);
                      setInviteMenuOpen(null);
                    }}
                    style={{
                      padding: '10px 12px', background: 'var(--ab)', border: 'none', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, color: 'var(--ac)', cursor: 'pointer',
                    }}>
                    🔗 Copia link
                  </button>
                  <button
                    onClick={() => {
                      const text = `Unisciti a ${f.name} su Fammy! 🎉 ${window.location.origin}/invite/${f.invite_token || 'temp'}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                      setInviteMenuOpen(null);
                    }}
                    style={{
                      padding: '10px 12px', background: '#25D366', border: 'none', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer',
                    }}>
                    💬 WhatsApp
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: `Unisciti a ${f.name}`,
                          text: `Unisciti a ${f.name} su Fammy!`,
                          url: `${window.location.origin}/invite/${f.invite_token || 'temp'}`,
                        });
                      }
                      setInviteMenuOpen(null);
                    }}
                    style={{
                      padding: '10px 12px', background: 'var(--ab)', border: 'none', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, color: 'var(--ac)', cursor: 'pointer',
                    }}>
                    📤 Condividi
                  </button>
                </div>
              )}

              {isExpanded && (
                <div className="list" style={{ marginTop: 8 }}>
                  {familyMembers.map((m) => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      isMe={m.user_id === session.user.id}
                      isOwner={m.user_id === f.created_by}
                      onEdit={() => setEditingMember(m)}
                      onRemove={() => removeMember(m)}
                      onInvite={() => setShowFamilyInvite(true)}
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
            isOwner={m.user_id === family.created_by}
            onEdit={() => setEditingMember(m)}
            onRemove={() => removeMember(m)}
            onInvite={() => setShowFamilyInvite(true)}
          />
        ))}
      </div>

      <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn full secondary" onClick={() => setShowAdd(true)}>
          + {t('addmember_h')}
        </button>
        <button className="btn full" onClick={() => setShowFamilyInvite(true)}>
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

      {showFamilyInvite && (
        <FamilyInviteModal
          family={family}
          session={session}
          onClose={() => setShowFamilyInvite(false)}
        />
      )}
    </>
  );
}

function MemberCard({ member, isMe, isOwner, onEdit, onRemove, onInvite }) {
  const canInvite = !isMe && !member.user_id;

  return (
    <div className="member-card" onClick={onEdit}>
      <Avatar
        name={member.name}
        avatarUrl={member.avatar_url}
        avatarLetter={member.avatar_letter}
        avatarColor={member.avatar_color || '#1C1611'}
        size={40}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          {member.name}
          {isMe && <span style={{ fontSize: 11, color: 'var(--km)', fontWeight: 500 }}>(tu)</span>}
        </div>
        <div style={{ color: 'var(--km)', fontSize: 13 }}>
          {member.role || 'membro'}
          {member.user_id ? ' · ✓ ha account' : ' · senza account'}
        </div>
      </div>

      {/* Badge OWNER/MEMBER */}
      {isOwner && (
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
          background: '#FF6B6B', color: 'white', textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>OWNER</span>
      )}
      {!isOwner && member.user_id && (
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
          background: 'var(--km)', color: 'white', textTransform: 'uppercase',
          letterSpacing: 0.5, opacity: 0.6,
        }}>MEMBER</span>
      )}

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
