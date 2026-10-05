import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useOnlineStatus } from '../../context/PresenceContext';
import { supabase } from '../../supabaseClient';
import { addDays, fetchEventsForEmployees, getAvailability, EVENT_TYPES, formatDateRangeFr } from '../../utils/calendarEvents';
import { formatLastSeen } from '../../utils/lastSeen';
import { TERMINATED_STATUS_IDS } from '../../constants/statuts';
import StatusBadge from '../../components/StatusBadge';
import Avatar from '../../components/Avatar';

// Fiche technicien complète (port du modal "selectedTechnicien" de ManagerDashboard.jsx web) :
// infos, charge de travail, et disponibilité calendrier.
export default function TechnicianDetailScreen({ route }) {
  const { technicienId } = route.params;
  const { onlineIds } = useOnlineStatus();
  const [technicien, setTechnicien] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [{ data: emp }, { data: reps }, evts] = await Promise.all([
      supabase.from('employes').select('*').eq('id_employe', technicienId).single(),
      supabase
        .from('reparations')
        .select('id_reparation, numero_suivi, id_statut_actuel, statuts ( libelle ), appareils ( marque, modele )')
        .eq('id_technicien', technicienId)
        .order('date_prise_en_charge', { ascending: false }),
      fetchEventsForEmployees([technicienId], new Date(), addDays(new Date(), 60))
    ]);
    setTechnicien(emp);
    setRepairs(reps || []);
    setEvents(evts);
    setLoading(false);
  }, [technicienId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading || !technicien) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const online = onlineIds.has(technicien.id_employe);
  const avail = getAvailability(events, technicien.id_employe);
  const total = repairs.length;
  const terminees = repairs.filter((r) => TERMINATED_STATUS_IDS.includes(r.id_statut_actuel)).length;
  const restantes = total - terminees;
  const enCours = repairs.filter((r) => !TERMINATED_STATUS_IDS.includes(r.id_statut_actuel));
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter((e) => e.date_fin >= todayIso);

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 20 }}>
      <View className="bg-white rounded-2xl border border-slate-200 p-5 items-center mb-4">
        <Avatar url={technicien.avatar_url} name={`${technicien.prenom} ${technicien.nom}`} size={72} online={online} />
        <Text className="text-lg font-bold text-slate-800 mt-3">{technicien.prenom} {technicien.nom}</Text>
        <Text className="text-sm text-slate-500 mt-0.5">{technicien.email}</Text>
        {technicien.telephone && <Text className="text-sm text-slate-500">{technicien.telephone}</Text>}

        <View className={`px-3 py-1 rounded-full mt-3 ${online ? 'bg-emerald-100' : avail.busy ? 'bg-amber-100' : 'bg-slate-100'}`}>
          <Text className={`text-xs font-bold ${online ? 'text-emerald-700' : avail.busy ? 'text-amber-700' : 'text-slate-500'}`}>
            {online ? 'En ligne' : avail.busy ? `Occupé jusqu'au ${formatDateRangeFr(avail.until, avail.until)}` : formatLastSeen(technicien.last_seen)}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-2 mb-4">
        <View className="flex-1 bg-white rounded-xl border border-slate-200 p-3 items-center">
          <Text className="text-xl font-extrabold text-slate-800">{total}</Text>
          <Text className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Assignées</Text>
        </View>
        <View className="flex-1 bg-white rounded-xl border border-slate-200 p-3 items-center">
          <Text className="text-xl font-extrabold text-amber-500">{restantes}</Text>
          <Text className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Restantes</Text>
        </View>
        <View className="flex-1 bg-white rounded-xl border border-slate-200 p-3 items-center">
          <Text className="text-xl font-extrabold text-emerald-500">{terminees}</Text>
          <Text className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Terminées</Text>
        </View>
      </View>

      <Text className="text-xs font-bold text-slate-400 uppercase mb-2">Réparations en cours</Text>
      {enCours.length === 0 && <Text className="text-sm text-slate-400 italic mb-4">Aucune réparation en cours.</Text>}
      {enCours.map((rep) => (
        <View key={rep.id_reparation} className="bg-white rounded-xl border border-slate-200 p-3 mb-2 flex-row items-center justify-between">
          <View>
            <Text className="font-mono text-xs font-bold text-slate-500">{rep.numero_suivi}</Text>
            <Text className="text-sm text-slate-700">{rep.appareils?.marque} {rep.appareils?.modele}</Text>
          </View>
          <StatusBadge idStatut={rep.id_statut_actuel} label={rep.statuts?.libelle} />
        </View>
      ))}

      <Text className="text-xs font-bold text-slate-400 uppercase mb-2 mt-2">Disponibilité (60 prochains jours)</Text>
      {upcomingEvents.length === 0 && <Text className="text-sm text-slate-400 italic">Aucun événement à venir — disponible.</Text>}
      {upcomingEvents.map((e) => (
        <View key={e.id_evenement} className="bg-white rounded-xl border border-slate-200 p-3 mb-2 flex-row items-center gap-2">
          <View className={`w-2 h-2 rounded-full ${EVENT_TYPES[e.type]?.dot || EVENT_TYPES.autre.dot}`} />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-slate-700">{e.titre}</Text>
            <Text className="text-xs text-slate-400">{formatDateRangeFr(e.date_debut, e.date_fin)}</Text>
          </View>
        </View>
      ))}
      <View className="h-8" />
    </ScrollView>
  );
}
