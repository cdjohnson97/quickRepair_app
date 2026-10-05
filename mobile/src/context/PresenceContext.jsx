import { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const PresenceContext = createContext({ onlineIds: new Set() });

const HEARTBEAT_MS = 60000;

// Port du PresenceContext web (src/context/PresenceContext.jsx) : même canal Realtime
// `online-users`, donc un technicien connecté sur mobile apparaît "en ligne" côté web et vice-versa.
export const PresenceProvider = ({ children }) => {
  const { userData } = useAuth();
  const [onlineIds, setOnlineIds] = useState(new Set());

  useEffect(() => {
    if (!userData?.id_employe) return;

    const touchLastSeen = () => {
      supabase.from('employes').update({ last_seen: new Date().toISOString() }).eq('id_employe', userData.id_employe).then(() => {});
    };

    const channel = supabase.channel('online-users', {
      config: { presence: { key: String(userData.id_employe) } }
    });

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
      if (AppState.currentState === 'active') touchLastSeen();
    }, HEARTBEAT_MS);

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') touchLastSeen();
    });

    return () => {
      clearInterval(heartbeat);
      appStateSub.remove();
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [userData?.id_employe]);

  return (
    <PresenceContext.Provider value={{ onlineIds }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const useOnlineStatus = () => useContext(PresenceContext);
