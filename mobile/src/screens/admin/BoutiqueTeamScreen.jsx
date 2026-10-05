import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useOnlineStatus } from '../../context/PresenceContext';
import { supabase } from '../../supabaseClient';
import { fetchEventsForEmployees } from '../../utils/calendarEvents';
import { getStatusLine } from '../../utils/statusLine';
import Avatar from '../../components/Avatar';

// Port de la colonne "Équipe assignée" de AdminDashboard.jsx (web) pour une boutique donnée.
export default function BoutiqueTeamScreen({ route, navigation }) {
  const { boutique } = route.params;
  const { onlineIds } = useOnlineStatus();
  const [equipe, setEquipe] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTeam = useCallback(async () => {
    const { data } = await supabase.from('employes').select('*').eq('id_boutique', boutique.id_boutique).order('role', { ascending: true });
    const emp = data || [];
    setEquipe(emp);
    if (emp.length > 0) {
      const today = new Date();
      const evts = await fetchEventsForEmployees(emp.map((e) => e.id_employe), today, today);
      setEvents(evts);
    }
    setLoading(false);
    setRefreshing(false);
  }, [boutique.id_boutique]);

  useEffect(() => {
    navigation.setOptions({ title: boutique.nom });
  }, [navigation, boutique.nom]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTeam();
  };

  const promouvoirManager = (idEmploye) => {
    Alert.alert('Désigner comme Responsable ?', "L'actuel responsable passera au rôle de technicien.", [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        onPress: async () => {
          await supabase.from('employes').update({ role: 'Technicien' }).eq('id_boutique', boutique.id_boutique).eq('role', 'Responsable');
          await supabase.from('employes').update({ role: 'Responsable' }).eq('id_employe', idEmploye);
          fetchTeam();
        }
      }
    ]);
  };

  const supprimerEmploye = (idEmploye, nom) => {
    Alert.alert('Supprimer cet employé ?', `Retirer ${nom} de l'effectif de la boutique ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('employes').delete().eq('id_employe', idEmploye);
          fetchTeam();
        }
      }
    ]);
  };

  return (
    <View className="flex-1 bg-slate-50">
      <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
        <Text className="text-slate-500 flex-1" numberOfLines={1}>{boutique.adresse}, {boutique.ville}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('NewEmployee', { boutique })} className="bg-blue-600 w-10 h-10 rounded-full items-center justify-center">
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={equipe}
        keyExtractor={(item) => String(item.id_employe)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
        renderItem={({ item }) => {
          const status = getStatusLine({ online: onlineIds.has(item.id_employe), events, idEmploye: item.id_employe, lastSeen: item.last_seen });
          return (
            <TouchableOpacity
              onPress={() => navigation.navigate('EmployeeDetail', { employeId: item.id_employe })}
              activeOpacity={0.7}
              className={`rounded-2xl border p-4 mb-3 ${item.role === 'Responsable' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <Avatar url={item.avatar_url} name={`${item.prenom} ${item.nom}`} size={44} online={onlineIds.has(item.id_employe)} />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="font-bold text-slate-800">{item.prenom} {item.nom}</Text>
                      {item.role === 'Responsable' && <Feather name="star" size={13} color="#f59e0b" />}
                    </View>
                    <Text className="text-xs text-slate-400 mt-0.5">{item.email}</Text>
                    <View className="flex-row items-center gap-2 mt-1">
                      <View className={`px-2 py-0.5 rounded-full ${item.role === 'Responsable' ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                        <Text className={`text-[10px] font-bold uppercase ${item.role === 'Responsable' ? 'text-indigo-700' : 'text-slate-600'}`}>{item.role}</Text>
                      </View>
                      <Text className={`text-[10px] ${status.className}`}>{status.text}</Text>
                    </View>
                  </View>
                </View>
                <View className="gap-2 items-end">
                  {item.role !== 'Responsable' && (
                    <TouchableOpacity onPress={() => promouvoirManager(item.id_employe)} className="p-1.5">
                      <Feather name="trending-up" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => supprimerEmploye(item.id_employe, `${item.prenom} ${item.nom}`)} className="p-1.5">
                    <Feather name="user-minus" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={!loading && (
          <View className="flex-1 items-center justify-center pt-16">
            <Text className="text-center text-slate-400 italic">Aucun employé dans cette boutique.</Text>
          </View>
        )}
      />
    </View>
  );
}
