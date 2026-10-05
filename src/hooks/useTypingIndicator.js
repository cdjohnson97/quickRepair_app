import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

const TYPING_TIMEOUT_MS = 3000;

// Écoute les événements "typing" destinés à `myId` sur son canal boîte de réception
// (`typing-inbox-{myId}`, alimenté par MessageThread quel que soit le fil ouvert ou non).
// Retourne l'ensemble des id_employe actuellement en train d'écrire à myId.
export function useTypingIndicator(myId) {
  const [typingIds, setTypingIds] = useState(new Set());
  const timeoutsRef = useRef({});

  useEffect(() => {
    if (!myId) return;

    const channel = supabase.channel(`typing-inbox-${myId}`);
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const from = payload?.from;
        if (!from) return;

        setTypingIds((prev) => new Set(prev).add(from));

        clearTimeout(timeoutsRef.current[from]);
        timeoutsRef.current[from] = setTimeout(() => {
          setTypingIds((prev) => {
            const next = new Set(prev);
            next.delete(from);
            return next;
          });
        }, TYPING_TIMEOUT_MS);
      })
      .subscribe();

    const timeouts = timeoutsRef.current;
    return () => {
      Object.values(timeouts).forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [myId]);

  return typingIds;
}
