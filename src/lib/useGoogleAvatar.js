import { useEffect } from 'react';
import { supabase } from './supabase.js';

/**
 * Hook per salvare automaticamente l'avatar da Google al primo login
 * Estrae la foto profilo dai metadati di auth.users e la salva in profiles.avatar_url
 */
export function useGoogleAvatar(session, profile) {
  useEffect(() => {
    if (!session || !profile || profile.avatar_url) {
      // Non agire se: no session, no profile, oppure avatar_url esiste già
      return;
    }

    const saveGoogleAvatar = async () => {
      try {
        // Recupera i dati completi dell'utente autenticato
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return;

        // Estrai la foto profilo dai metadati
        const avatarUrl = user.user_metadata?.picture || user.user_metadata?.avatar_url;
        if (!avatarUrl) return; // Nessuna foto disponibile

        // Salva l'URL nel database
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', session.user.id);

        if (updateError) {
          console.error('Errore nel salvataggio avatar:', updateError);
        }
      } catch (err) {
        console.error('Errore nella funzione useGoogleAvatar:', err);
      }
    };

    saveGoogleAvatar();
  }, [session?.user.id, profile?.id]);
}
