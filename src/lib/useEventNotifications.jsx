import { useEffect, useState, useRef } from 'react';
import { supabase } from './supabase.js';

const NOTIFICATION_CHECK_INTERVAL = 60000; // 1 minuto

const NOTIFICATIONS_ENABLED_KEY = 'fammy_notifications_enabled';

/**
 * Hook per gestire le notifiche push per gli eventi
 * - Notifiche 30 minuti prima dei tuoi eventi
 * - Notifiche quando nuovi eventi sono creati nella famiglia
 */
export function useEventNotifications(session, profile, families, events, taskAssignees) {
  const [notificationPermission, setNotificationPermission] = useState(Notification?.permission || 'default');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    return saved === null ? true : saved === 'true'; // Default true
  });
  const scheduledNotificationsRef = useRef(new Map()); // Traccia le notifiche già programmate

  // Inizializza il service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      return;
    }

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.log('SW registration failed:', err);
    });
  }, []);

  // Richiedi permessi di notifica al primo accesso (non invasivo)
  useEffect(() => {
    if (Notification?.permission === 'default' && session?.user?.id) {
      // Mostra il prompt di permessi in modo non invasivo
      setTimeout(() => {
        Notification.requestPermission().then((perm) => {
          setNotificationPermission(perm);
        });
      }, 3000); // Aspetta 3 secondi dopo il caricamento
    }
  }, [session?.user?.id]);

  // Monitora gli eventi e programma le notifiche
  useEffect(() => {
    if (notificationPermission !== 'granted' || !session?.user?.id || !notificationsEnabled) {
      return;
    }

    // Trova i tuoi eventi (quelli assegnati a te)
    const myEvents = events.filter((event) => {
      const startTime = new Date(event.starts_at);
      return startTime > new Date(); // Solo eventi futuri
    });

    myEvents.forEach((event) => {
      const notificationKey = `event-${event.id}`;

      // Evita di programmare la stessa notifica due volte
      if (scheduledNotificationsRef.current.has(notificationKey)) {
        return;
      }

      const eventTime = new Date(event.starts_at);
      const notificationTime = new Date(eventTime.getTime() - 30 * 60 * 1000); // 30 minuti prima
      const now = new Date();

      if (notificationTime > now) {
        const delay = notificationTime.getTime() - now.getTime();
        const timeoutId = setTimeout(() => {
          showEventNotification(event);
          scheduledNotificationsRef.current.delete(notificationKey);
        }, delay);

        scheduledNotificationsRef.current.set(notificationKey, timeoutId);
      }
    });

    // Cleanup: cancella i timeout dei vecchi eventi
    return () => {
      scheduledNotificationsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      scheduledNotificationsRef.current.clear();
    };
  }, [events, notificationPermission, session?.user?.id, notificationsEnabled]);

  // Monitora gli eventi della famiglia per nuovi eventi
  useEffect(() => {
    if (notificationPermission !== 'granted' || !session?.user?.id || !notificationsEnabled) {
      return;
    }

    let lastCheckTime = new Date();
    let unsubscribe = null;

    const setupRealtimeListener = async () => {
      if (!families || families.length === 0) return;

      const familyIds = families.map((f) => f.id);

      // Subscribe a nuovi eventi in tempo reale
      const subscription = supabase
        .from('events')
        .on('*', (payload) => {
          if (payload.eventType === 'INSERT') {
            const newEvent = payload.new;
            // Mostra notifica solo se l'evento è per una delle tue famiglie
            if (familyIds.includes(newEvent.family_id) && newEvent.created_by !== session.user.id) {
              const family = families.find((f) => f.id === newEvent.family_id);
              showNewEventNotification(newEvent, family);
            }
          }
        })
        .subscribe();

      return subscription;
    };

    setupRealtimeListener().then((sub) => {
      unsubscribe = sub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe.unsubscribe();
      }
    };
  }, [families, notificationPermission, session?.user?.id, notificationsEnabled]);

  return {
    notificationPermission,
    notificationsEnabled,
    requestPermission: () => {
      if (Notification?.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          setNotificationPermission(perm);
        });
      }
    },
    setNotificationsEnabled: (enabled) => {
      setNotificationsEnabled(enabled);
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled));
    },
  };
}

/**
 * Mostra una notifica per un evento imminente
 */
function showEventNotification(event) {
  if (!('Notification' in window)) return;

  const startTime = new Date(event.starts_at);
  const timeStr = startTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const notification = new Notification(`📅 ${event.title}`, {
    body: `Tra 30 minuti alle ${timeStr}`,
    icon: '/icon.png',
    badge: '/icon.png',
    tag: `event-${event.id}`,
    requireInteraction: false,
  });

  // Click apre l'app
  notification.addEventListener('click', () => {
    window.focus();
    notification.close();
  });
}

/**
 * Mostra una notifica per un nuovo evento creato da altri
 */
function showNewEventNotification(event, family) {
  if (!('Notification' in window)) return;

  const startTime = new Date(event.starts_at);
  const dateStr = startTime.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  const notification = new Notification(`✨ Nuovo evento in ${family?.name || 'Famiglia'}`, {
    body: `${event.title} - ${dateStr}`,
    icon: '/icon.png',
    badge: '/icon.png',
    tag: `new-event-${event.id}`,
    requireInteraction: false,
  });

  notification.addEventListener('click', () => {
    window.focus();
    notification.close();
  });
}
