import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useOnlineStatus } from '../../context/PresenceContext';
import { supabase } from '../../supabaseClient';
import Avatar from '../../components/Avatar';

// Contacts d'un technicien : le manager + ses collègues techniciens de la même boutique
// (port de fetchContacts dans src/pages/technicien/TechDashboard.jsx).
export default function TechMessagesScreen({ navigation }) {
  const { userData } = useAuth();
  const { onlineIds } = useOnlineStatus();
  const [contacts, setContacts] = useState([]);
  const [unreadByContact, setUnreadByContact] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const fetchContacts = useCallback(async () => {
    if (!userData?.id_boutique) return;
    const { data } = await supabase
      .from('employes')
      .select('id_employe, prenom, nom, role, avatar_url, last_seen')
      .eq('id_boutique', userData.id_boutique)
      .in('role', ['Responsable', 'Technicien'])
      .neq('id_employe', userData.id_employe);
    setContacts(data || []);
  }, [userData?.id_boutique]);

  const fetchUnread = useCallback(async () => {
    if (!userData?.id_employe) return;
    const { data } = await supabase.from('messages').select('id_expediteur').eq('id_destinataire', userData.id_employe).eq('lu', false);
    const counts = {};
    (data || []).forEach((m) => { counts[m.id_expediteur] = (counts[m.id_expediteur] || 0) + 1; });
    setUnreadByContact(counts);
  }, [userData?.id_employe]);

  useEffect(() => {
    fetchContacts();
    fetchUnread();
  }, [fetchContacts, fetchUnread]);

  useEffect(() => {
    if (!userData?.id_employe) return;
    const channel = supabase
      .channel('tech-messages-channel-mobile')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `id_destinataire=eq.${userData.id_employe}` }, () => {
        fetchUnread();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userData?.id_employe, fetchUnread]);

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchContacts(), fetchUnread()]).finally(() => setRefreshing(false));
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-extrabold text-slate-800">Messages</Text>
      </View>
      <FlatList
        data={contacts}
        keyExtractor={(item) => String(item.id_employe)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('Chat', { contact: item })}
            activeOpacity={0.7}
            className="flex-row items-center justify-between bg-white rounded-2xl border border-slate-200 p-3 mb-2 shadow-sm"
          >
            <View className="flex-row items-center gap-3">
              <Avatar url={item.avatar_url} name={`${item.prenom} ${item.nom}`} size={44} online={onlineIds.has(item.id_employe)} />
              <View>
                <Text className="font-bold text-slate-800">{item.prenom} {item.nom}</Text>
                <Text className="text-xs text-slate-400 mt-0.5">{item.role === 'Responsable' ? 'Manager' : 'Collègue'}</Text>
              </View>
            </View>
            {unreadByContact[item.id_employe] > 0 ? (
              <View className="bg-red-500 w-5 h-5 rounded-full items-center justify-center">
                <Text className="text-white text-[10px] font-bold">{unreadByContact[item.id_employe]}</Text>
              </View>
            ) : (
              <Feather name="chevron-right" size={18} color="#cbd5e1" />
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={(
          <View className="flex-1 items-center justify-center pt-16">
            <Text className="text-center text-slate-400 italic">Aucun contact disponible.</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
