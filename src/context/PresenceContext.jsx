import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const PresenceContext = createContext({ onlineIds: new Set() });

const HEARTBEAT_MS = 60000;

// Présence en ligne partagée par toute l'app : un seul canal Realtime Presence,
// suivi une fois que l'utilisateur est authentifié.
export const PresenceProvider = ({ children }) => {
  const { userData } = useAuth();
  const [onlineIds, setOnlineIds] = useState(new Set());
  const channelRef = useRef(null);

  useEffect(() => {
    if (!userData?.id_employe) return;

    const touchLastSeen = () => {
      supabase.from('employes').update({ last_seen: new Date().toISOString() }).eq('id_employe', userData.id_employe).then(() => {});
    };

    const channel = supabase.channel('online-users', {
      config: { presence: { key: String(userData.id_employe) } }
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineIds(new Set(Object.keys(state).map(Number)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ id_employe: userData.id_employe });
          touchLastSeen();
        }
      });

    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') touchLastSeen();
    }, HEARTBEAT_MS);

    return () => {
      clearInterval(heartbeat);
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userData?.id_employe]);

  return (
    <PresenceContext.Provider value={{ onlineIds }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const useOnlineStatus = () => useContext(PresenceContext);
