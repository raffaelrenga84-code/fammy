import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useT } from '../lib/i18n.jsx';
import BachecaTab from './tabs/BachecaTab.jsx';
import AgendaTab from './tabs/AgendaTab.jsx';
import SpeseTab from './tabs/SpeseTab.jsx';
import FamilyTab from './tabs/FamilyTab.jsx';
import ProfileTab from './tabs/ProfileTab.jsx';
import NewFamilyModal from '../components/NewFamilyModal.jsx';

export default function HomeScreen({ session, profile, families, onRefresh }) {
  const { t } = useT();
  // activeFamily può essere un UUID specifico o 'all'
  const [activeFamily, setActiveFamily] = useState(families[0]?.id);
  const [activeTab, setActiveTab] = useState('bacheca');
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [taskAssignees, setTaskAssignees] = useState([]); // [{task_id, member_id}, ...]
  const [refreshKey, setRefreshKey] = useState(0);
  const [showNewFamily, setShowNewFamily] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(() => {
    // Mostra il banner solo se non è stato mai chiuso
    const dismissed = localStorage.getItem('fammy_pwa_banner_dismissed');
    return !dismissed;
  });

  useEffect(() => {
    if (activeFamily !== 'all' && !families.find((f) => f.id === activeFamily) && families.length > 0) {
      setActiveFamily(families[0].id);
    }
  }, [families, activeFamily]);

  // Carica dati: una famiglia o tutte
  useEffect(() => {
    if (!activeFamily) return;
    const dataFamilyIds = activeFamily === 'all' ? families.map((f) => f.id) : [activeFamily];
    // I MEMBRI vengono SEMPRE caricati per TUTTE le famiglie dell'utente
    // (così si può assegnare un task cross-famiglia)
    const allFamilyIds = families.map((f) => f.id);
    if (dataFamilyIds.length === 0) return;

    let cancelled = false;
    (async () => {
      const [tRes, mRes, eRes, exRes] = await Promise.all([
        supabase.from('tasks').select('*').in('family_id', dataFamilyIds).order('created_at', { ascending: false }),
        supabase.from('members').select('*').in('family_id', allFamilyIds).order('created_at'),
        supabase.from('events').select('*').in('family_id', dataFamilyIds).order('starts_at'),
        supabase.from('expenses').select('*').in('family_id', dataFamilyIds).order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;

      const taskIds = (tRes.data || []).map((t) => t.id);
      let aRes = { data: [] };
      if (taskIds.length > 0) {
        aRes = await supabase.from('task_assignees').select('*').in('task_id', taskIds);
      }

      setTasks(tRes.data || []);
      setMembers(mRes.data || []);
      setEvents(eRes.data || []);
      setExpenses(exRes.data || []);
      setTaskAssignees(aRes.data || []);
    })();
    return () => { cancelled = true; };
  }, [activeFamily, refreshKey, families]);

  const refresh = () => setRefreshKey((k) => k + 1);
  const refreshAll = () => { refresh(); onRefresh && onRefresh(); };

  const isAll = activeFamily === 'all';
  const family = isAll ? null : families.find((f) => f.id === activeFamily);
  // "me" è il mio membro nella famiglia attiva (o uno qualsiasi se vista all)
  const me = isAll
    ? members.find((m) => m.user_id === session.user.id)
    : members.find((m) => m.user_id === session.user.id && m.family_id === activeFamily);

  // Sul tab Profilo l'header con famiglie non ha senso: lo nascondiamo.
  const showHeader = activeTab !== 'profile';

  const dismissBanner = () => {
    localStorage.setItem('fammy_pwa_banner_dismissed', 'true');
    setShowInstallBanner(false);
  };

  // Riconosce il device
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const hintText = isIOS ? t('pwa_banner_hint_ios') : t('pwa_banner_hint_android');

  return (
    <div className="scr">
      {/* Banner: Add to Home Screen (multilingua) */}
      {showInstallBanner && (
        <div style={{
          background: 'linear-gradient(135deg, var(--ac) 0%, #4A90E2 100%)',
          color: 'white',
          padding: '14px 16px',
          borderRadius: '12px 12px 0 0',
          margin: '-16px -16px 16px -16px',
          fontSize: 14,
          lineHeight: 1.5,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20 }}>📱</span>
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', marginBottom: 4 }}>{t('pwa_banner_title')}</strong>
              <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 8 }}>
                {hintText}
              </div>
              <button onClick={dismissBanner} style={{
                background: 'rgba(255,255,255,0.3)',
                border: 'none',
                color: 'white',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}>
                {t('pwa_banner_dismiss')}
              </button>
            </div>
            <button onClick={dismissBanner} style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: 20,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}>✕</button>
          </div>
        </div>
      )}

      {showHeader && (
        <Header
          family={family}
          members={isAll ? members.filter((m) => m.family_id === families[0]?.id) : members}
          allMembers={members}
          tasks={tasks}
          families={families}
          activeFamily={activeFamily}
          isAll={isAll}
          onSwitchFamily={setActiveFamily}
          onNewFamily={() => setShowNewFamily(true)}
        />
      )}

      <div className="tab-content">
        {activeTab === 'bacheca' && (
          <BachecaTab
            familyId={isAll ? null : activeFamily}
            families={families}
            tasks={tasks}
            members={members}
            taskAssignees={taskAssignees}
            me={me}
            session={session}
            isAll={isAll}
            onChanged={refresh}
          />
        )}
        {activeTab === 'agenda' && (
          <AgendaTab
            familyId={isAll ? null : activeFamily}
            events={events}
            members={members}
            me={me}
            isAll={isAll}
            families={families}
            onChanged={refresh}
          />
        )}
        {activeTab === 'spese' && !isAll && (
          <SpeseTab familyId={activeFamily} expenses={expenses} tasks={tasks} members={members} me={me} onChanged={refresh} />
        )}
        {activeTab === 'spese' && isAll && (
          <div className="empty">
            <div className="empty-emoji">💶</div>
            <h3>{t('filter_mine')}</h3>
            <p>Le spese si vedono per famiglia. Seleziona una famiglia specifica nello switcher in alto.</p>
          </div>
        )}
        {activeTab === 'famiglia' && !isAll && (
          <FamilyTab
            family={family}
            members={members}
            session={session}
            families={families}
            activeFamily={activeFamily}
            onSwitchFamily={setActiveFamily}
            onNewFamily={() => setShowNewFamily(true)}
            onChanged={refreshAll}
          />
        )}
        {activeTab === 'famiglia' && isAll && (
          <div className="empty">
            <div className="empty-emoji">👥</div>
            <h3>Vista per famiglia</h3>
            <p>I membri si gestiscono per famiglia. Seleziona una famiglia specifica nello switcher in alto.</p>
          </div>
        )}
        {activeTab === 'profile' && (
          <ProfileTab session={session} profile={profile} onChanged={refreshAll} />
        )}
      </div>

      {showNewFamily && (
        <NewFamilyModal
          session={session}
          profile={profile}
          onClose={() => setShowNewFamily(false)}
          onCreated={() => { setShowNewFamily(false); refreshAll(); }}
        />
      )}

      <nav className="bnav">
        <NavBtn icon="🏠" label={t('nav_bacheca')} active={activeTab === 'bacheca'} onClick={() => setActiveTab('bacheca')} />
        <NavBtn icon="📅" label={t('nav_agenda')} active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} />
        <NavBtn icon="💶" label={t('nav_spese')} active={activeTab === 'spese'} onClick={() => setActiveTab('spese')} />
        <NavBtn icon="👥" label={t('nav_family')} active={activeTab === 'famiglia'} onClick={() => setActiveTab('famiglia')} />
        <NavBtn icon="👤" label={t('nav_profile')} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
      </nav>
    </div>
  );
}

function Header({ family, members, allMembers, tasks, families, activeFamily, isAll, onSwitchFamily, onNewFamily }) {
  const { t } = useT();
  const todoCount = tasks.filter((task) => task.status !== 'done').length;

  return (
    <>
      <header className="hdr">
        <div>
          {isAll ? (
            <>
              <h1>🌍 {t('all_families_chip').replace(/^🌍\s?/, '')}</h1>
              <p className="sub">
                {families.length} famiglie · {todoCount} {t('todo_label')}
              </p>
            </>
          ) : (
            <>
              <h1>{family?.emoji} {family?.name}</h1>
              <p className="sub">
                {members.length} {members.length === 1 ? t('member_one') : t('member_other')} · {todoCount} {t('todo_label')}
              </p>
            </>
          )}
        </div>
      </header>

      <div className="fam-switcher-wrap">
        <div className="fam-switcher">
          {families.length > 1 && (
            <button
              className={`fam-chip ${isAll ? 'on' : ''}`}
              onClick={() => onSwitchFamily('all')}>
              {t('all_families_chip')}
            </button>
          )}
          {families.map((f) => (
            <button key={f.id}
              className={`fam-chip ${activeFamily === f.id ? 'on' : ''}`}
              onClick={() => onSwitchFamily(f.id)}>
              {f.emoji} {f.name}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>
      <span className="ic">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
