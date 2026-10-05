import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useOnlineStatus } from '../../context/PresenceContext';
import { supabase } from '../../supabaseClient';
import { fetchEventsForEmployees } from '../../utils/calendarEvents';
import { getStatusLine } from '../../utils/statusLine';
import { TERMINATED_STATUS_IDS } from '../../constants/statuts';
import StatusBadge from '../../components/StatusBadge';
import Avatar from '../../components/Avatar';
import MessageThread from '../../components/MessageThread';

// Port de la fiche employé de AdminDashboard.jsx (web) : infos + charge de travail si
// Technicien, section Messagerie si Responsable (même MessageThread que le manager/technicien,
// donc les messages sont échangés en direct avec le web).
export default function EmployeeDetailScreen({ route, navigation }) {
  const { employeId } = route.params;
  const { userData } = useAuth();
  const { onlineIds } = useOnlineStatus();
  const [employe, setEmploye] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const { data: emp } = await supabase.from('employes').select('*').eq('id_employe', employeId).single();
    setEmploye(emp);

    if (emp?.role === 'Technicien') {
      const { data: reps } = await supabase
        .from('reparations')
        .select('id_reparation, numero_suivi, id_statut_actuel, statuts ( libelle ), appareils ( marque, modele )')
        .eq('id_technicien', employeId)
        .order('date_prise_en_charge', { ascending: false });
      setRepairs(reps || []);
    }

    const evts = await fetchEventsForEmployees([employeId], new Date(), new Date());
    setEvents(evts);
    setLoading(false);
  }, [employeId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (employe) navigation.setOptions({ title: `${employe.prenom} ${employe.nom}` });
  }, [navigation, employe]);

  if (loading || !employe) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const online = onlineIds.has(employe.id_employe);
  const status = getStatusLine({ online, events, idEmploye: employe.id_employe, lastSeen: employe.last_seen });
  const total = repairs.length;
  const terminees = repairs.filter((r) => TERMINATED_STATUS_IDS.includes(r.id_statut_actuel)).length;
  const restantes = total - terminees;
  const enCours = repairs.filter((r) => !TERMINATED_STATUS_IDS.includes(r.id_statut_actuel));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      className="flex-1 bg-slate-50"
    >
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <View className="bg-white rounded-2xl border border-slate-200 p-5 items-center mb-4">
        <Avatar url={employe.avatar_url} name={`${employe.prenom} ${employe.nom}`} size={72} online={online} />
        <View className="flex-row items-center gap-1.5 mt-3">
          <Text className="text-lg font-bold text-slate-800">{employe.prenom} {employe.nom}</Text>
          {employe.role === 'Responsable' && <Feather name="star" size={14} color="#f59e0b" />}
        </View>
        <Text className="text-sm text-slate-500 mt-0.5">{employe.email}</Text>
        {employe.telephone && <Text className="text-sm text-slate-500">{employe.telephone}</Text>}
        <View className="bg-slate-100 px-3 py-1 rounded-full mt-2">
          <Text className="text-xs font-bold text-slate-600 uppercase">{employe.role}</Text>
        </View>
        <Text className={`text-xs mt-2 ${status.className}`}>{status.text}</Text>
      </View>

      {employe.role === 'Technicien' && (
        <>
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
        </>
      )}

      {employe.role === 'Responsable' && userData?.id_employe && (
        <>
          <Text className="text-xs font-bold text-slate-400 uppercase mb-2 mt-2">Messagerie</Text>
          <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ height: 420 }}>
            <MessageThread
              currentUserId={userData.id_employe}
              otherUserId={employe.id_employe}
              otherUserName={`${employe.prenom} ${employe.nom}`}
              otherUserAvatar={employe.avatar_url}
            />
          </View>
        </>
      )}
      <View className="h-8" />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
