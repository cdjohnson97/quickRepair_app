import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useOnlineStatus } from '../../context/PresenceContext';
import { supabase } from '../../supabaseClient';
import { addDays, fetchEventsForEmployees, getAvailability, toISODate } from '../../utils/calendarEvents';
import RepairCard from '../../components/RepairCard';
import Avatar from '../../components/Avatar';

// Tableau de bord manager : KPIs, disponibilité de l'équipe, recherche + filtre,
// liste cliquable — port de l'essentiel de ManagerDashboard.jsx (web).
export default function ManagerRepairListScreen({ navigation }) {
  const { userData } = useAuth();
  const { onlineIds } = useOnlineStatus();
  const [repairs, setRepairs] = useState([]);
  const [techniciens, setTechniciens] = useState([]);
  const [teamEvents, setTeamEvents] = useState([]);
  const [techFilter, setTechFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expiringToast, setExpiringToast] = useState(null);
  const expiringCheckedRef = useRef(false);
  const toastTimerRef = useRef(null);

  const fetchAll = useCallback(async () => {
    if (!userData?.id_boutique) return;
    const { data: techs } = await supabase
      .from('employes')
      .select('id_employe, prenom, nom, avatar_url')
      .eq('role', 'Technicien')
      .eq('id_boutique', userData.id_boutique);
    setTechniciens(techs || []);

    if (techs && techs.length > 0) {
      const [{ data: repData }, events] = await Promise.all([
        supabase
          .from('reparations')
          .select(`
            id_reparation, numero_suivi, description_panne, date_prise_en_charge, id_statut_actuel, id_technicien,
            statuts ( libelle ),
            appareils ( marque, modele, clients ( nom, prenom ) ),
            employes ( prenom, nom )
          `)
          .in('id_technicien', techs.map((t) => t.id_employe))
          .order('date_prise_en_charge', { ascending: false }),
        fetchEventsForEmployees(techs.map((t) => t.id_employe), new Date(), new Date())
      ]);
      setRepairs(repData || []);
      setTeamEvents(events);
    }
    setLoading(false);
    setRefreshing(false);
  }, [userData?.id_boutique]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Rappel : réparation arrivant à échéance sans que le ticket soit clôturé — port de
  // checkExpiringRepairs (ManagerDashboard.jsx web), en toast custom (pas de SweetAlert2
  // sur mobile) qui se ferme tout seul après 8s, une seule fois par montage de l'écran.
  useEffect(() => {
    if (expiringCheckedRef.current) return;
    if (teamEvents.length === 0 && techniciens.length === 0) return;
    expiringCheckedRef.current = true;

    const todayIso = toISODate(new Date());
    const yesterdayIso = toISODate(addDays(new Date(), -1));
    const expiring = teamEvents
      .filter((ev) => ev.type === 'reparation' && ev.id_reparation && (ev.date_fin === todayIso || ev.date_fin === yesterdayIso))
      .map((ev) => repairs.find((r) => r.id_reparation === ev.id_reparation))
      .filter((rep) => rep && ![6, 8].includes(rep.id_statut_actuel));

    if (expiring.length === 0) return;
    setExpiringToast(expiring);
    toastTimerRef.current = setTimeout(() => setExpiringToast(null), 8000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamEvents]);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const stats = {
    total: repairs.length,
    enCours: repairs.filter((r) => r.id_statut_actuel === 5).length,
    terminees: repairs.filter((r) => [6, 8].includes(r.id_statut_actuel)).length
  };

  const searchLower = search.toLowerCase();
  const filtered = repairs.filter((r) => {
    const matchSearch =
      r.numero_suivi.toLowerCase().includes(searchLower) ||
      r.appareils?.clients?.nom?.toLowerCase().includes(searchLower) ||
      r.appareils?.clients?.prenom?.toLowerCase().includes(searchLower);
    const matchTech = techFilter === 'ALL' || r.id_technicien === techFilter;
    return matchSearch && matchTech;
  });

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {expiringToast && (
        <View className="absolute top-2 left-4 right-4 z-50 bg-amber-50 border border-amber-300 rounded-2xl p-3 shadow-lg">
          <View className="flex-row items-start gap-2">
            <Feather name="alert-triangle" size={18} color="#b45309" style={{ marginTop: 2 }} />
            <View className="flex-1">
              <Text className="text-amber-800 font-bold text-sm mb-1">Réparations en retard possible</Text>
              {expiringToast.map((rep) => (
                <Text key={rep.id_reparation} className="text-amber-700 text-xs mb-0.5">
                  Ticket <Text className="font-bold">{rep.numero_suivi}</Text> ({rep.employes?.prenom || ''} {rep.employes?.nom || ''}) devait être terminé
                </Text>
              ))}
            </View>
            <TouchableOpacity onPress={() => setExpiringToast(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color="#b45309" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id_reparation)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 90, flexGrow: 1 }}
        renderItem={({ item }) => (
          <RepairCard repair={item} showTechnicien onPress={() => navigation.navigate('ManagerRepairDetail', { repairId: item.id_reparation })} />
        )}
        ListEmptyComponent={!loading && (
          <View className="flex-1 items-center justify-center pt-16">
            <Text className="text-center text-slate-400 italic">Aucune réparation pour le moment.</Text>
          </View>
        )}
        ListHeaderComponent={
          <View>
            <View className="pt-4 pb-3">
              <Text className="text-2xl font-extrabold text-slate-800">Tableau de bord</Text>
              <Text className="text-slate-500 mt-0.5">Vue analytique et gestion de l'équipe</Text>
            </View>

            <View className="flex-row gap-2 mb-4">
              <View className="flex-1 bg-white rounded-xl border border-slate-200 p-3 items-center">
                <Text className="text-xl font-extrabold text-slate-800">{stats.total}</Text>
                <Text className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 text-center">Total</Text>
              </View>
              <View className="flex-1 bg-white rounded-xl border border-slate-200 p-3 items-center">
                <Text className="text-xl font-extrabold text-amber-500">{stats.enCours}</Text>
                <Text className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 text-center">En cours</Text>
              </View>
              <View className="flex-1 bg-white rounded-xl border border-slate-200 p-3 items-center">
                <Text className="text-xl font-extrabold text-emerald-500">{stats.terminees}</Text>
                <Text className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 text-center">Terminées</Text>
              </View>
            </View>

            {techniciens.length > 0 && (
              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-400 uppercase mb-2">Aujourd'hui</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {techniciens.map((t) => {
                    const avail = getAvailability(teamEvents, t.id_employe);
                    return (
                      <TouchableOpacity
                        key={t.id_employe}
                        onPress={() => navigation.navigate('Équipe', { screen: 'TechnicianDetail', params: { technicienId: t.id_employe } })}
                        className="flex-row items-center gap-1.5 bg-white border border-slate-200 rounded-full pl-1 pr-3 py-1"
                      >
                        <Avatar url={t.avatar_url} name={`${t.prenom} ${t.nom}`} size={26} online={onlineIds.has(t.id_employe)} />
                        <Text className="text-xs font-semibold text-slate-700">{t.prenom}</Text>
                        <View className={`px-1.5 py-0.5 rounded-full ${avail.busy ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                          <Text className={`text-[9px] font-bold ${avail.busy ? 'text-amber-700' : 'text-emerald-700'}`}>{avail.busy ? 'Occupé' : 'Libre'}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View className="flex-row items-center bg-white border border-slate-200 rounded-lg px-3 mb-3">
              <Feather name="search" size={16} color="#94a3b8" />
              <TextInput
                placeholder="Rechercher (n° suivi, client)..."
                value={search}
                onChangeText={setSearch}
                className="flex-1 px-2 py-2.5 text-sm"
              />
            </View>

            {techniciens.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} className="mb-3">
                <TouchableOpacity
                  onPress={() => setTechFilter('ALL')}
                  className={`px-4 py-2 rounded-full border ${techFilter === 'ALL' ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}
                >
                  <Text className={`text-xs font-bold ${techFilter === 'ALL' ? 'text-white' : 'text-slate-600'}`}>Tous</Text>
                </TouchableOpacity>
                {techniciens.map((t) => (
                  <TouchableOpacity
                    key={t.id_employe}
                    onPress={() => setTechFilter(t.id_employe)}
                    className={`px-4 py-2 rounded-full border ${techFilter === t.id_employe ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}
                  >
                    <Text className={`text-xs font-bold ${techFilter === t.id_employe ? 'text-white' : 'text-slate-600'}`}>{t.prenom}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        }
      />

      <TouchableOpacity
        onPress={() => navigation.navigate('NewTicket')}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 items-center justify-center shadow-lg"
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
