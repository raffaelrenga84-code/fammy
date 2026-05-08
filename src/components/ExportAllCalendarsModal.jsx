import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

/**
 * Modal per esportare tutti i calendari delle famiglie con colori diversi
 * Crea un unico iCalendar file con tutti gli eventi raggruppati per famiglia
 */
export default function ExportAllCalendarsModal({ families, onClose, onChanged }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Carica i token per tutte le famiglie
  useState(() => {
    const loadTokens = async () => {
      setLoading(true);
      const fTokens = families.map((f) => ({
        family: f,
        token: f.ical_token,
        url: `${window.location.origin}/api/ical/${f.ical_token}.ics`,
      }));
      setTokens(fTokens);
      setLoading(false);
    };
    loadTokens();
  }, [families]);

  const FAMILY_COLORS = {
    // Colori specifici per ogni posizione (poi rotatiamo in base all'indice)
    0: '#3674D9', // Blu
    1: '#E8A500', // Oro
    2: '#C84A36', // Rosso caldo
    3: '#3D8F5E', // Verde
    4: '#D97A42', // Arancione
    5: '#7C3AED', // Viola
    6: '#E91E8C', // Magenta
  };

  const getFamilyColor = (index) => {
    return FAMILY_COLORS[index % Object.keys(FAMILY_COLORS).length];
  };

  const handleRegenerateAll = async () => {
    if (!confirm('Rigenerare i token per TUTTE le famiglie? I vecchi URL smetteranno di funzionare.')) return;

    setBusy(true);
    try {
      const updates = await Promise.all(
        families.map((f) =>
          supabase.rpc('regenerate_ical_token', { family: f.id })
        )
      );
      setTokens(
        families.map((f, i) => ({
          family: f,
          token: updates[i].data,
          url: `${window.location.origin}/api/ical/${updates[i].data}.ics`,
        }))
      );
      onChanged?.();
    } catch (e) {
      alert('Errore: ' + e.message);
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="modal-bg" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <span className="spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>📅 Esporta tutti i calendari</h2>
        <p className="modal-sub">
          Aggiungi <strong>tutti gli eventi di tutte le famiglie</strong> al calendario del telefono.
          Ogni famiglia avrà un colore diverso per distinguerli facilmente.
        </p>

        {/* Legenda colori */}
        <div style={{ marginBottom: 20, padding: 12, background: 'var(--s)', borderRadius: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--k)' }}>
            🎨 Colori per famiglia:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {families.map((f, idx) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: getFamilyColor(idx),
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600 }}>{f.emoji} {f.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Istruzioni */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--fs)', fontSize: 16, marginBottom: 8 }}>
            📱 Come aggiungere al telefono
          </h3>
          <p style={{ fontSize: 13, color: 'var(--km)', lineHeight: 1.6, marginBottom: 12 }}>
            <strong>iPhone:</strong> Copia gli URL qui sotto → Impostazioni → Calendario → Account → Aggiungi → Altro → Aggiungi calendario sottoscritto
          </p>
          <p style={{ fontSize: 13, color: 'var(--km)', lineHeight: 1.6 }}>
            <strong>Android:</strong> Copia gli URL → Apri calendar.google.com (da PC) → Altri calendari → Da URL → Incolla
          </p>
        </div>

        {/* Lista URL */}
        <div style={{ marginBottom: 16, maxHeight: '200px', overflowY: 'auto' }}>
          {tokens.map((t, idx) => (
            <div key={t.family.id} style={{ marginBottom: 12, padding: 10, background: 'white', border: '1px solid var(--sm)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: getFamilyColor(idx),
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {t.family.emoji} {t.family.name}
                </span>
              </div>
              <div
                style={{
                  padding: 8,
                  background: 'var(--s)',
                  border: '1px solid var(--sm)',
                  borderRadius: 6,
                  fontSize: 10,
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  color: 'var(--km)',
                  lineHeight: 1.4,
                }}
              >
                {t.url}
              </div>
            </div>
          ))}
        </div>

        {/* Privacy warning */}
        <div style={{ marginTop: 16, padding: 12, background: 'var(--rdB)', borderRadius: 12, fontSize: 12, color: 'var(--rd)' }}>
          ⚠️ <strong>Privacy:</strong> Chi ha questi URL può leggere gli eventi. Se finiscono nelle mani sbagliate, premi "Rigenera" qui sotto.
        </div>

        <div className="row" style={{ marginTop: 20 }}>
          <button type="button" className="btn secondary" onClick={onClose}>
            Chiudi
          </button>
          <button type="button" className="btn danger" onClick={handleRegenerateAll} disabled={busy}>
            {busy ? <span className="spin" /> : '🔄 Rigenera tutti'}
          </button>
        </div>
      </div>
    </div>
  );
}
