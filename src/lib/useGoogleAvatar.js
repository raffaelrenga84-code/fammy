import { useEffect } from 'react';
import { supabase } from './supabase.js';

/**
 * Hook per sincronizzare i dati Google al login:
 *  - avatar_url (foto profilo Google)
 *  - display_name / member.name (se mancanti)
 *  - birth_date (se l'utente ha concesso lo scope Google People API)
 *
 * Aggiorna sia profiles che tutti i members dell'utente, ma solo se i campi
 * sono mancanti (così non sovrascrive valori inseriti manualmente).
 */
export function useGoogleAvatar(session, profile) {
  useEffect(() => {
    if (!session || !profile) return;

    const userId = session.user.id;

    const sync = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const meta = user.user_metadata || {};
        const avatarUrl = meta.picture || meta.avatar_url || null;
        const fullName = meta.full_name || meta.name || null;

        // 1. Avatar e nome -> profiles (solo se mancanti)
        const profileUpdate = {};
        if (avatarUrl && !profile.avatar_url) profileUpdate.avatar_url = avatarUrl;
        if (fullName && (!profile.display_name || profile.display_name.includes('@'))) {
          profileUpdate.display_name = fullName;
        }
        if (Object.keys(profileUpdate).length > 0) {
          await supabase.from('profiles').update(profileUpdate).eq('id', userId);
        }

        // 2. Avatar -> members dell'utente (solo dove avatar_url è null)
        if (avatarUrl) {
          await supabase
            .from('members')
            .update({ avatar_url: avatarUrl })
            .eq('user_id', userId)
            .is('avatar_url', null);
        }

        // 3. Birthday da Google People API (se scope concesso)
        const providerToken = session.provider_token
          || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('fammy_google_provider_token') : null);
        if (providerToken) {
          try { sessionStorage.setItem('fammy_google_provider_token', providerToken); } catch (e) {}
          await syncGoogleBirthday(providerToken, userId);
        }
      } catch (err) {
        console.warn('useGoogleAvatar sync error:', err);
      }
    };

    sync();
  }, [session?.user?.id, profile?.id]);
}

/**
 * Chiama Google People API per recuperare la data di nascita
 * e la salva nei members dell'utente (solo se birth_date è null).
 */
async function syncGoogleBirthday(providerToken, userId) {
  try {
    const res = await fetch(
      'https://people.googleapis.com/v1/people/me?personFields=birthdays',
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    if (!res.ok) return;

    const data = await res.json();
    const bd = (data.birthdays || []).find((b) => b.date && b.date.year);
    if (!bd) return;

    const { year, month, day } = bd.date;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    await supabase
      .from('members')
      .update({ birth_date: dateStr })
      .eq('user_id', userId)
      .is('birth_date', null);
  } catch (err) {
    console.warn('syncGoogleBirthday error:', err);
  }
}
