import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import RepairCard from '../../components/RepairCard';

// Recherche (n° suivi / client) + filtre par statut — port de filterStatut
// (TechDashboard.jsx web), avec en plus une recherche texte pour matcher l'ergonomie
// du tableau de bord manager mobile.
export default function TechRepairListScreen({ navigation }) {
  const { userData } = useAuth();
  const [repairs, setRepairs] = useState([]);
  const [statuts, setStatuts] = useState([]);
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRepairs = useCallback(async () => {
    if (!userData?.id_employe) return;
    const [{ data: statutsData }, { data, error }] = await Promise.all([
      supabase.from('statuts').select('*').order('id_statut', { ascending: true }),
      supabase
        .from('reparations')
        .select(`
          id_reparation, numero_suivi, description_panne, date_prise_en_charge, id_statut_actuel,
          statuts ( libelle ),
          appareils ( marque, modele, clients ( nom, prenom, telephone ) )
        `)
        .eq('id_technicien', userData.id_employe)
        .order('date_prise_en_charge', { ascending: false })
    ]);

    setStatuts(statutsData || []);
    if (!error) setRepairs(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [userData?.id_employe]);

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRepairs();
  };

  const searchLower = search.toLowerCase();
  const filtered = repairs.filter((r) => {
    const matchSearch =
      r.numero_suivi.toLowerCase().includes(searchLower) ||
      r.appareils?.clients?.nom?.toLowerCase().includes(searchLower) ||
      r.appareils?.clients?.prenom?.toLowerCase().includes(searchLower);
    const matchStatut = statutFilter === 'ALL' || r.id_statut_actuel === statutFilter;
    return matchSearch && matchStatut;
  });

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
        <View>
          <Text className="text-2xl font-extrabold text-slate-800">Bonjour, {userData?.prenom} !</Text>
          <Text className="text-slate-500 mt-0.5">Vos réparations assignées</Text>
        </View>
        <View className="bg-blue-600 rounded-full w-12 h-12 items-center justify-center shadow-sm">
          <Text className="text-white font-extrabold text-base">{repairs.length}</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id_reparation)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
        renderItem={({ item }) => (
          <RepairCard repair={item} onPress={() => navigation.navigate('TechRepairDetail', { repairId: item.id_reparation })} />
        )}
        ListEmptyComponent={!loading && (
          <View className="flex-1 items-center justify-center pt-16">
            <Text className="text-center text-slate-400 italic">
              {repairs.length === 0 ? 'Aucune réparation assignée pour le moment.' : 'Aucune réparation ne correspond à ce filtre.'}
            </Text>
          </View>
        )}
        ListHeaderComponent={repairs.length > 0 && (
          <View className="mb-3">
            <View className="flex-row items-center bg-white border border-slate-200 rounded-lg px-3 mb-3">
              <Feather name="search" size={16} color="#94a3b8" />
              <TextInput
                placeholder="Rechercher (n° suivi, client)..."
                value={search}
                onChangeText={setSearch}
                className="flex-1 px-2 py-2.5 text-sm"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                onPress={() => setStatutFilter('ALL')}
                className={`px-4 py-2 rounded-full border ${statutFilter === 'ALL' ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}
              >
                <Text className={`text-xs font-bold ${statutFilter === 'ALL' ? 'text-white' : 'text-slate-600'}`}>Toutes</Text>
              </TouchableOpacity>
              {statuts.map((s) => (
                <TouchableOpacity
                  key={s.id_statut}
                  onPress={() => setStatutFilter(s.id_statut)}
                  className={`px-4 py-2 rounded-full border ${statutFilter === s.id_statut ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}
                >
                  <Text className={`text-xs font-bold ${statutFilter === s.id_statut ? 'text-white' : 'text-slate-600'}`}>{s.libelle}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
