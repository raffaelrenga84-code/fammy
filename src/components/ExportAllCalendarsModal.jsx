import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

/**
 * Modal per esportare i calendari delle famiglie con selezione granulare
 * Permette di scegliere quali famiglie esportare
 */
export default function ExportAllCalendarsModal({ families, onClose, onChanged }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState({});
  const [copied, setCopied] = useState({});

  // Carica i token per tutte le famiglie e inizializza selezione
  useEffect(() => {
    const loadTokens = async () => {
      setLoading(true);
      const fTokens = families.map((f) => ({
        family: f,
        token: f.ical_token,
        url: `${window.location.origin}/api/ical/${f.ical_token}.ics`,
      }));
      setTokens(fTokens);

      // Di default seleziona tutte le famiglie
      const defaultSelected = {};
      families.forEach((f) => {
        defaultSelected[f.id] = true;
      });
      setSelected(defaultSelected);
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

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const selectedFamilies = families.filter((f) => selected[f.id]);
  const selectedTokens = tokens.filter((t) => selected[t.family.id]);

  const handleToggle = (familyId) => {
    setSelected((prev) => ({
      ...prev,
      [familyId]: !prev[familyId],
    }));
  };

  const handleSelectAll = () => {
    const newSelected = {};
    families.forEach((f) => {
      newSelected[f.id] = true;
    });
    setSelected(newSelected);
  };

  const handleSelectNone = () => {
    setSelected({});
  };

  const handleCopyUrl = (url, familyId) => {
    navigator.clipboard.writeText(url);
    setCopied({ [familyId]: true });
    setTimeout(() => setCopied({}), 2000);
  };

  const handleRegenerateSelected = async () => {
    if (selectedCount === 0) {
      alert('Seleziona almeno una famiglia');
      return;
    }

    const familiesText = selectedFamilies.map((f) => f.name).join(', ');
    if (!confirm(`Rigenerare i token per: ${familiesText}?\nI vecchi URL smetteranno di funzionare.`)) return;

    setBusy(true);
    try {
      const updates = await Promise.all(
        selectedFamilies.map((f) =>
          supabase.rpc('regenerate_ical_token', { family: f.id })
        )
      );

      setTokens((prevTokens) =>
        prevTokens.map((t, idx) => {
          if (!selected[t.family.id]) return t;
          const updateIdx = selectedFamilies.findIndex((f) => f.id === t.family.id);
          return {
            family: t.family,
            token: updates[updateIdx].data,
            url: `${window.location.origin}/api/ical/${updates[updateIdx].data}.ics`,
          };
        })
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
        <h2>📅 Esporta calendari</h2>
        <p className="modal-sub">
          Seleziona quali famiglie esportare al calendario del telefono.
          Ogni famiglia avrà un colore diverso per distinguerli facilmente.
        </p>

        {/* Selezione famiglie */}
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--s)', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--k)' }}>
              🎨 Seleziona famiglie ({selectedCount}/{families.length})
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  background: 'white',
                  border: '1px solid var(--sm)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Tutte
              </button>
              <button
                type="button"
                onClick={handleSelectNone}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  background: 'white',
                  border: '1px solid var(--sm)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Nessuna
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {families.map((f, idx) => (
              <label
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  cursor: 'pointer',
                  padding: 8,
                  background: 'white',
                  borderRadius: 6,
                  border: '1px solid var(--sm)',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected[f.id] || false}
                  onChange={() => handleToggle(f.id)}
                  style={{ cursor: 'pointer', width: 18, height: 18 }}
                />
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: getFamilyColor(idx),
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600 }}>{f.emoji} {f.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Istruzioni */}
        {selectedCount > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--s)', borderRadius: 12 }}>
            <h3 style={{ fontFamily: 'var(--fs)', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--k)' }}>
              📱 Come aggiungere al telefono
            </h3>
            <p style={{ fontSize: 12, color: 'var(--km)', lineHeight: 1.6, marginBottom: 8 }}>
              <strong>iPhone:</strong> Copia URL → Impostazioni → Calendario → Account → Aggiungi → Altro → Aggiungi calendario sottoscritto
            </p>
            <p style={{ fontSize: 12, color: 'var(--km)', lineHeight: 1.6 }}>
              <strong>Android:</strong> Copia URL → Apri calendar.google.com → Altri calendari → Da URL → Incolla
            </p>
          </div>
        )}

        {/* Lista URL selezionati */}
        {selectedCount > 0 ? (
          <div style={{ marginBottom: 16, maxHeight: '220px', overflowY: 'auto' }}>
            {selectedTokens.map((t, idx) => {
              const familyIdx = families.findIndex((f) => f.id === t.family.id);
              return (
                <div key={t.family.id} style={{ marginBottom: 12, padding: 12, background: 'white', border: '1px solid var(--sm)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: getFamilyColor(familyIdx),
                      }}
                    />
                    <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>
                      {t.family.emoji} {t.family.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(t.url, t.family.id)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        background: copied[t.family.id] ? '#22c55e' : 'white',
                        color: copied[t.family.id] ? 'white' : 'var(--k)',
                        border: '1px solid var(--sm)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {copied[t.family.id] ? '✓ Copiato' : '📋 Copia'}
                    </button>
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
              );
            })}
          </div>
        ) : (
          <div style={{ marginBottom: 16, padding: 16, background: 'var(--s)', borderRadius: 8, textAlign: 'center', color: 'var(--km)', fontSize: 13 }}>
            Seleziona almeno una famiglia per vedere gli URL
          </div>
        )}

        {/* Privacy warning */}
        {selectedCount > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--rdB)', borderRadius: 12, fontSize: 11, color: 'var(--rd)' }}>
            ⚠️ <strong>Privacy:</strong> Chi ha questi URL può leggere gli eventi. Se necessario, premi "Rigenera" per generare nuovi URL.
          </div>
        )}

        <div className="row" style={{ marginTop: 16 }}>
          <button type="button" className="btn secondary" onClick={onClose}>
            Chiudi
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={handleRegenerateSelected}
            disabled={busy || selectedCount === 0}
            title={selectedCount === 0 ? 'Seleziona almeno una famiglia' : ''}
          >
            {busy ? <span className="spin" /> : `🔄 Rigenera ${selectedCount > 0 ? `(${selectedCount})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
