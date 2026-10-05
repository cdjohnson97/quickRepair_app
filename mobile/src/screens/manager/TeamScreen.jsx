import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useOnlineStatus } from '../../context/PresenceContext';
import { supabase } from '../../supabaseClient';
import { TERMINATED_STATUS_IDS } from '../../constants/statuts';
import Avatar from '../../components/Avatar';

export default function TeamScreen({ navigation }) {
  const { userData } = useAuth();
  const { onlineIds } = useOnlineStatus();
  const [techStats, setTechStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTeam = useCallback(async () => {
    if (!userData?.id_boutique) return;
    const { data: techs } = await supabase
      .from('employes')
      .select('id_employe, prenom, nom, email, avatar_url')
      .eq('role', 'Technicien')
      .eq('id_boutique', userData.id_boutique);

    const map = new Map((techs || []).map((t) => [t.id_employe, { technicien: t, total: 0, terminees: 0, restantes: 0 }]));

    if (techs && techs.length > 0) {
      const { data: repairs } = await supabase
        .from('reparations')
        .select('id_statut_actuel, id_technicien')
        .in('id_technicien', techs.map((t) => t.id_employe));

      (repairs || []).forEach((rep) => {
        const entry = map.get(rep.id_technicien);
        if (!entry) return;
        entry.total += 1;
        if (TERMINATED_STATUS_IDS.includes(rep.id_statut_actuel)) entry.terminees += 1;
        else entry.restantes += 1;
      });
    }

    setTechStats(Array.from(map.values()));
    setLoading(false);
    setRefreshing(false);
  }, [userData?.id_boutique]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTeam();
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-extrabold text-slate-800">Équipe technique</Text>
        <Text className="text-slate-500 mt-0.5">{techStats.length} technicien{techStats.length > 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={techStats}
        keyExtractor={(item) => String(item.technicien.id_employe)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('TechnicianDetail', { technicienId: item.technicien.id_employe })}
            activeOpacity={0.7}
            className="bg-white rounded-2xl border border-slate-200 p-4 mb-3 shadow-sm"
          >
            <View className="flex-row items-center gap-3 mb-3">
              <Avatar url={item.technicien.avatar_url} name={`${item.technicien.prenom} ${item.technicien.nom}`} size={44} online={onlineIds.has(item.technicien.id_employe)} />
              <View className="flex-1">
                <Text className="font-bold text-slate-800 text-base">{item.technicien.prenom} {item.technicien.nom}</Text>
                <Text className="text-xs text-slate-400 mt-0.5">{item.total} réparation{item.total > 1 ? 's' : ''} assignée{item.total > 1 ? 's' : ''}</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#cbd5e1" />
            </View>
            <View className="flex-row gap-2">
              <View className="bg-amber-100 px-3 py-1.5 rounded-full">
                <Text className="text-amber-700 text-xs font-bold">{item.restantes} restante{item.restantes > 1 ? 's' : ''}</Text>
              </View>
              <View className="bg-emerald-100 px-3 py-1.5 rounded-full">
                <Text className="text-emerald-700 text-xs font-bold">{item.terminees} terminée{item.terminees > 1 ? 's' : ''}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading && (
          <View className="flex-1 items-center justify-center pt-16">
            <Text className="text-center text-slate-400 italic">Aucun technicien dans cette boutique.</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
