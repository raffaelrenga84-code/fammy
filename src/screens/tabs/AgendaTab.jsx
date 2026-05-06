import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useT } from '../../lib/i18n.jsx';
import AddEventModal from '../../components/AddEventModal.jsx';
import CalendarShareModal from '../../components/CalendarShareModal.jsx';

// Espande gli eventi: per quelli ricorrenti, genera istanze nei giorni
// pertinenti tra (start originale) e (recurring_until o +12 mesi).
function expandEvents(events) {
  const expanded = [];
  const horizonEnd = new Date();
  horizonEnd.setMonth(horizonEnd.getMonth() + 12);

  for (const ev of events) {
    if (!ev.recurring_days || ev.recurring_days.length === 0) {
      expanded.push(ev);
      continue;
    }
    const start = new Date(ev.starts_at);
    const until = ev.recurring_until ? new Date(ev.recurring_until) : horizonEnd;
    // Sempre genera anche l'istanza "originale"
    expanded.push(ev);

    // Itera giorno per giorno fino a until, generando occorrenze
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() + 1);
    while (cursor <= until) {
      // 0=Lun, 6=Dom (nel nostro schema)
      const wd = (cursor.getDay() + 6) % 7;
      if (ev.recurring_days.includes(wd)) {
        const occ = new Date(cursor);
        occ.setHours(start.getHours(), start.getMinutes(), start.getSeconds());
        expanded.push({
          ...ev,
          id: `${ev.id}__${occ.toISOString().slice(0, 10)}`,
          _origId: ev.id,
          starts_at: occ.toISOString(),
          _isRecurringInstance: true,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return expanded;
}

export default function AgendaTab({ familyId, families, events, members, me, isAll, onChanged }) {
  const { t } = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [openSections, setOpenSections] = useState({ today: true, future: true, past: false });

  const expandedEvents = expandEvents(events);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const today = new Date();
  // Se un giorno è selezionato, usalo come punto di riferimento; altrimenti usa oggi
  const referenceDay = selectedDay || new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfToday = new Date(referenceDay.getFullYear(), referenceDay.getMonth(), referenceDay.getDate());
  const endOfToday = new Date(referenceDay.getFullYear(), referenceDay.getMonth(), referenceDay.getDate() + 1);

  // Non filtrare per selectedDay: mostra tutti gli eventi, ma suddivisi da referenceDay
  const filtered = expandedEvents;

  const todayEvents = filtered.filter((e) => {
    const d = new Date(e.starts_at);
    return d >= startOfToday && d < endOfToday;
  });
  const futureEvents = filtered.filter((e) => new Date(e.starts_at) >= endOfToday);
  const pastEvents = filtered.filter((e) => new Date(e.starts_at) < startOfToday);

  const removeEvent = async (event) => {
    if (!confirm(t('agenda_delete_confirm'))) return;
    // Cancella sempre l'evento originale (non l'istanza ricorrente)
    const idToDelete = event._origId || event.id;
    await supabase.from('events').delete().eq('id', idToDelete);
    onChanged();
  };

  const targetFamilyId = familyId || families?.[0]?.id;
  const targetFamily = families?.find((f) => f.id === targetFamilyId);
  const getFamily = (event) => families?.find((f) => f.id === event.family_id);
  const toggle = (k) => setOpenSections((s) => ({ ...s, [k]: !s[k] }));

  return (
    <>
      <MonthGrid
        month={viewMonth}
        events={expandedEvents}
        selectedDay={selectedDay}
        onSelectDay={(d) => setSelectedDay(selectedDay && sameDay(selectedDay, d) ? null : d)}
        onPrev={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
        onNext={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
      />

      {!isAll && targetFamily && (
        <div style={{ padding: '4px 16px 12px' }}>
          <button className="btn full secondary" onClick={() => setShowCalendar(true)}>
            {t('family_export_calendar')}
          </button>
        </div>
      )}

      {expandedEvents.length === 0 ? (
        <div className="empty">
          <div className="empty-emoji">📅</div>
          <h3>{t('agenda_empty_h')}</h3>
          <p>{t('agenda_empty_p')}</p>
        </div>
      ) : (
        <>
          <CollapsibleSection
            label={t('agenda_today')}
            count={todayEvents.length}
            open={openSections.today}
            onToggle={() => toggle('today')}
            accent="var(--am)"
          >
            {todayEvents.length > 0
              ? todayEvents.map((e) => <EventCard key={e.id} event={e} family={isAll ? getFamily(e) : null} onRemove={() => removeEvent(e)} />)
              : <p style={{ padding: '0 22px 12px', color: 'var(--km)', fontSize: 13 }}>—</p>}
          </CollapsibleSection>

          <CollapsibleSection
            label={t('agenda_future')}
            count={futureEvents.length}
            open={openSections.future}
            onToggle={() => toggle('future')}
          >
            {futureEvents.length > 0
              ? futureEvents.slice(0, 50).map((e) => <EventCard key={e.id} event={e} family={isAll ? getFamily(e) : null} onRemove={() => removeEvent(e)} />)
              : <p style={{ padding: '0 22px 12px', color: 'var(--km)', fontSize: 13 }}>—</p>}
          </CollapsibleSection>

          {pastEvents.length > 0 && (
            <CollapsibleSection
              label={t('agenda_past')}
              count={pastEvents.length}
              open={openSections.past}
              onToggle={() => toggle('past')}
            >
              {pastEvents.slice(0, 50).map((e) => <EventCard key={e.id} event={e} family={isAll ? getFamily(e) : null} past onRemove={() => removeEvent(e)} />)}
            </CollapsibleSection>
          )}
        </>
      )}

      <button className="fab" onClick={() => setShowAdd(true)}>+</button>

      {showAdd && (
        <AddEventModal
          familyId={targetFamilyId}
          authorMemberId={me?.id}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); onChanged(); }}
        />
      )}

      {showCalendar && targetFamily && (
        <CalendarShareModal
          family={targetFamily}
          onClose={() => setShowCalendar(false)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

function MonthGrid({ month, events, selectedDay, onSelectDay, onPrev, onNext }) {
  const { t } = useT();
  const weekdays = t('weekday_short');
  const months = t('months');

  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const lastDay = new Date(year, m + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (d) => d && today.getFullYear() === year && today.getMonth() === m && today.getDate() === d;

  const eventsByDay = {};
  events.forEach((e) => {
    const d = new Date(e.starts_at);
    if (d.getFullYear() === year && d.getMonth() === m) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(e);
    }
  });

  return (
    <div className="month-grid-wrap">
      <div className="month-header">
        <button className="month-nav" onClick={onPrev}>‹</button>
        <span className="month-title">{Array.isArray(months) ? months[m] : ''} {year}</span>
        <button className="month-nav" onClick={onNext}>›</button>
      </div>
      <div className="month-weekdays">
        {Array.isArray(weekdays) && weekdays.map((w, i) => <div key={i} className="month-weekday">{w}</div>)}
      </div>
      <div className="month-cells">
        {cells.map((d, i) => {
          const hasEvents = d && eventsByDay[d];
          const isSelected = d && selectedDay && selectedDay.getFullYear() === year && selectedDay.getMonth() === m && selectedDay.getDate() === d;
          return (
            <button key={i} className={`month-cell ${isToday(d) ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
              disabled={!d}
              onClick={() => d && onSelectDay(new Date(year, m, d))}>
              {d && <span className="month-day">{d}</span>}
              {hasEvents && <span className="month-dot" />}
            </button>
          );
        })}
      </div>
      {selectedDay && (
        <div style={{
          background: 'var(--am)',
          border: '1.5px solid var(--am)',
          borderRadius: 12,
          padding: '12px 16px',
          margin: '12px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 14,
          fontWeight: 600,
          color: '#7A5A00',
        }}>
          <span>📌 {selectedDay.getDate()} {Array.isArray(t('months')) ? t('months')[selectedDay.getMonth()] : ''} selezionato</span>
          <button onClick={() => onSelectDay(selectedDay)} style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            padding: 0,
            color: 'inherit',
          }}>✕</button>
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({ label, count, open, onToggle, children, accent }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <button onClick={onToggle} className="collapsible-header" style={accent ? { borderLeft: `3px solid ${accent}` } : {}}>
        <span className="collapsible-arrow" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>›</span>
        <span className="collapsible-label">{label}</span>
        <span className="collapsible-count">{count}</span>
      </button>
      {open && <div className="list">{children}</div>}
    </div>
  );
}

function EventCard({ event, family, past, onRemove }) {
  const start = new Date(event.starts_at);
  return (
    <div className="card" style={{ opacity: past ? 0.6 : 1 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div className="event-date">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--km)', textTransform: 'uppercase' }}>
            {start.toLocaleDateString(undefined, { month: 'short' })}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--k)' }}>
            {start.getDate()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--km)' }}>
            {start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
            {event.title}
            {event._isRecurringInstance && <span style={{ fontSize: 12 }} title="Ricorrente">🔁</span>}
            {event.recurring_days && !event._isRecurringInstance && <span style={{ fontSize: 12 }} title="Ricorrente">🔁</span>}
          </div>
          {family && (
            <div style={{
              display: 'inline-block', padding: '2px 8px', borderRadius: 100,
              background: family.color ? family.color + '22' : 'var(--sm)',
              color: family.color || 'var(--km)',
              fontSize: 11, fontWeight: 600, marginTop: 4,
            }}>
              {family.emoji} {family.name}
            </div>
          )}
          {event.location && <div style={{ color: 'var(--km)', fontSize: 13, marginTop: 4 }}>📍 {event.location}</div>}
          {event.description && <div style={{ color: 'var(--km)', fontSize: 13, marginTop: 4 }}>{event.description}</div>}
        </div>
        <button onClick={onRemove}
          style={{ background: 'none', border: 'none', color: 'var(--km)', fontSize: 16, padding: 4 }}>✕</button>
      </div>
    </div>
  );
}
