import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

const TYPING_TIMEOUT_MS = 3000;

// Port direct de src/hooks/useTypingIndicator.js (web) : même convention de canal
// `typing-inbox-{myId}`, alimentée par MessageThread côté web ET mobile.
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
