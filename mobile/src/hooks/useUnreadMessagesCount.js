import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// Compteur global de messages non lus, utilisé pour le badge de l'onglet "Messages".
export function useUnreadMessagesCount(myId) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!myId) return;

    const fetchCount = async () => {
      const { count: c } = await supabase
        .from('messages')
        .select('id_message', { count: 'exact', head: true })
        .eq('id_destinataire', myId)
        .eq('lu', false);
      setCount(c || 0);
    };

    fetchCount();

    const channel = supabase
      .channel('unread-badge-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `id_destinataire=eq.${myId}` }, fetchCount)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [myId]);

  return count;
}
