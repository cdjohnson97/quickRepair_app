import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../supabaseClient';
import StatusBadge from '../../components/StatusBadge';

const BILLABLE_STATUS_IDS = [6, 7];

// Port du modal "selectedRepairDetail" de ManagerDashboard.jsx (web) : lecture seule,
// le manager consulte mais ne change pas le statut (seul le technicien le fait).
// Le bouton "Facturer" apparaît une fois la réparation Terminée/Prête, comme sur le web.
export default function ManagerRepairDetailScreen({ route, navigation }) {
  const { repairId } = route.params;
  const [repair, setRepair] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [{ data: repData }, { data: historyData }] = await Promise.all([
      supabase
        .from('reparations')
        .select(`
          id_reparation, numero_suivi, description_panne, date_prise_en_charge, id_statut_actuel,
          statuts ( libelle ),
          appareils ( marque, modele, clients ( nom, prenom, email, telephone ) ),
          employes ( prenom, nom )
        `)
        .eq('id_reparation', repairId)
        .single(),
      supabase
        .from('historique_statuts')
        .select('*, statuts(libelle), employes(prenom, nom)')
        .eq('id_reparation', repairId)
        .order('date_changement', { ascending: false })
    ]);

    setRepair(repData);
    setHistory(historyData || []);
    setLoading(false);
  }, [repairId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading || !repair) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 20 }}>
      <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-mono text-xs font-bold text-slate-500">#{repair.numero_suivi}</Text>
            <Text className="text-xl font-extrabold text-slate-800 mt-1">{repair.appareils?.marque} {repair.appareils?.modele}</Text>
          </View>
          {BILLABLE_STATUS_IDS.includes(repair.id_statut_actuel) && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Invoice', { repairId: repair.id_reparation })}
              className="flex-row items-center gap-1.5 bg-emerald-100 px-3 py-2 rounded-lg"
            >
              <Feather name="printer" size={14} color="#047857" />
              <Text className="text-emerald-700 text-xs font-bold">Facturer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text className="text-xs font-bold text-slate-400 uppercase mb-2">Description de la panne</Text>
      <View className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4 flex-row items-start gap-2">
        <Feather name="alert-circle" size={16} color="#dc2626" style={{ marginTop: 2 }} />
        <Text className="text-red-700 text-sm flex-1">{repair.description_panne}</Text>
      </View>

      <Text className="text-xs font-bold text-slate-400 uppercase mb-2">Informations client</Text>
      <View className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <Text className="font-bold text-slate-800">{repair.appareils?.clients?.prenom} {repair.appareils?.clients?.nom}</Text>
        <Text className="text-slate-500 text-sm mt-0.5">{repair.appareils?.clients?.email}</Text>
        <Text className="text-slate-500 text-sm">{repair.appareils?.clients?.telephone}</Text>
      </View>

      <Text className="text-xs font-bold text-slate-400 uppercase mb-2">Technicien assigné</Text>
      <View className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex-row items-center justify-between">
        <Text className="font-bold text-slate-800">{repair.employes?.prenom} {repair.employes?.nom}</Text>
        <StatusBadge idStatut={repair.id_statut_actuel} label={repair.statuts?.libelle} />
      </View>

      <Text className="text-xs font-bold text-slate-400 uppercase mb-2">Historique d'intervention</Text>
      {history.length === 0 && <Text className="text-sm text-slate-400 italic">Aucun changement de statut enregistré.</Text>}
      {history.map((h) => (
        <View key={h.id_historique} className="bg-white rounded-xl border border-slate-200 p-3 mb-2">
          <View className="flex-row justify-between items-center mb-1">
            <StatusBadge idStatut={h.id_statut} label={h.statuts?.libelle} />
            <Text className="text-[11px] text-slate-400 font-mono">
              {new Date(h.date_changement).toLocaleDateString('fr-FR')} à {new Date(h.date_changement).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {h.commentaire && <Text className="text-sm text-slate-600 italic mt-1">« {h.commentaire} »</Text>}
          <Text className="text-[10px] text-slate-400 text-right mt-1">Par {h.employes?.prenom} {h.employes?.nom}</Text>
        </View>
      ))}
      <View className="h-8" />
    </ScrollView>
  );
}
