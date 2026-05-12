import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useT } from '../lib/i18n.jsx';

/**
 * Modal unificato per gestire gli inviti di una famiglia
 * Mostra il codice/link di invito e la lista degli inviti pending
 */
export default function FamilyInviteModal({ family, session, onClose }) {
  const { t } = useT();
  const [inviteToken, setInviteToken] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  // Carica inviti e token
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Carica inviti pending della famiglia
        const { data: invites, error: invitesError } = await supabase
          .from('invitations')
          .select(`
            id, token, status, created_at, expires_at, member_id,
            members (id, name, role)
          `)
          .eq('family_id', family.id)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (!invitesError) {
          setInvitations(invites || []);
          // Usa il token del primo invito (di solito ce n'è uno per famiglia)
          if (invites && invites.length > 0) {
            setInviteToken(invites[0].token);
          }
        }

        // Se non ce n'è nessuno, crea un nuovo invito generico
        if (!invites || invites.length === 0) {
          const { data: newInvite, error: createError } = await supabase
            .from('invitations')
            .insert({
              family_id: family.id,
              member_id: null,
              invited_by: session.user.id,
            })
            .select()
            .single();

          if (!createError && newInvite) {
            setInviteToken(newInvite.token);
            setInvitations([newInvite]);
          }
        }
      } catch (err) {
        console.error('Errore nel caricamento inviti:', err);
      }
      setLoading(false);
    };

    loadData();
  }, [family.id, session.user.id]);

  const inviteUrl = inviteToken ? `${window.location.origin}/invite/${inviteToken}` : '';

  const shareMessage = `Ti invito a unirsi alla famiglia "${family.name}" su FAMMY! 🏡\n\nApri questo link:\n${inviteUrl}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const shareViaWeb = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invito a ${family.name}`,
          text: shareMessage,
          url: inviteUrl,
        });
      } catch {}
    } else {
      copyToClipboard();
    }
  };

  const shareViaWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, '_blank');
  };

  const regenerateToken = async () => {
    setBusy(true);
    try {
      // Annulla inviti vecchi
      await supabase
        .from('invitations')
        .update({ status: 'cancelled' })
        .eq('family_id', family.id)
        .eq('status', 'pending');

      // Crea nuovo invito
      const { data: newInvite, error } = await supabase
        .from('invitations')
        .insert({
          family_id: family.id,
          member_id: null,
          invited_by: session.user.id,
        })
        .select()
        .single();

      if (!error && newInvite) {
        setInviteToken(newInvite.token);
        setInvitations([newInvite]);
      }
    } catch (err) {
      console.error('Errore nel rigenerazione token:', err);
    }
    setBusy(false);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>🎁 {t('invite_people_to', { name: family.name })}</h2>
        <p className="modal-sub">{t('invite_share_hint')}</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <span className="spin" />
          </div>
        ) : (
          <>
            {/* Link di invito */}
            {inviteUrl && (
              <>
                <div style={{ marginBottom: 16, padding: 12, background: 'var(--s)', borderRadius: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--k)', marginBottom: 8 }}>
                    {t('invite_link_label')}
                  </div>
                  <div
                    style={{
                      padding: 10,
                      background: 'white',
                      border: '1px solid var(--sm)',
                      borderRadius: 8,
                      fontSize: 11,
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      color: 'var(--km)',
                      marginBottom: 8,
                      lineHeight: 1.4,
                    }}
                  >
                    {inviteUrl}
                  </div>

                  {/* Pulsanti condivisione */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button
                      className="btn full secondary"
                      onClick={copyToClipboard}
                      style={{ flex: 1 }}
                    >
                      {copied ? '✓' : '📋'} {t('copy_btn')}
                    </button>
                    <button
                      className="btn full secondary"
                      onClick={shareViaWeb}
                      style={{ flex: 1 }}
                    >
                      📤 Condividi
                    </button>
                  </div>

                  <button
                    className="btn full secondary"
                    onClick={shareViaWhatsApp}
                    style={{
                      background: '#25D366',
                      color: 'white',
                      border: 'none',
                    }}
                  >
                    💬 WhatsApp
                  </button>
                </div>

                {/* Inviti pending */}
                {invitations.length > 0 && (
                  <div style={{ marginBottom: 16, padding: 12, background: 'var(--s)', borderRadius: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--k)', marginBottom: 8 }}>
                      {t('invites_pending', { n: invitations.length })}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {invitations.map((inv) => {
                        const daysLeft = Math.ceil(
                          (new Date(inv.expires_at) - new Date()) / (1000 * 60 * 60 * 24)
                        );
                        const memberName = inv.members?.name || t('invite_generic');
                        return (
                          <div
                            key={inv.id}
                            style={{
                              padding: 8,
                              background: 'white',
                              border: '1px solid var(--sm)',
                              borderRadius: 6,
                              fontSize: 12,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                                {memberName}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--km)' }}>
                                {t('expires_in', { n: daysLeft, unit: daysLeft === 1 ? t('day_one') : t('day_many') })}
                              </div>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--ab)', fontWeight: 600 }}>
                              ⏳ Pending
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Info e rigenera */}
                <div style={{ marginBottom: 16, padding: 10, background: 'var(--ybB)', borderRadius: 8, fontSize: 11, color: 'var(--yb)' }}>
                  {t('expires_after_hint')}
                </div>

                <button
                  className="btn secondary full"
                  onClick={regenerateToken}
                  disabled={busy}
                  style={{ marginBottom: 12 }}
                >
                  {busy ? <span className="spin" /> : t('regenerate_new_link')}
                </button>
              </>
            )}
          </>
        )}

        <div className="row">
          <button className="btn secondary full" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
