import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../../supabaseClient';
import StatusBadge from '../../components/StatusBadge';

export default function TechRepairDetailScreen({ route, navigation }) {
  const { repairId } = route.params;
  const [repair, setRepair] = useState(null);
  const [statuts, setStatuts] = useState([]);
  const [history, setHistory] = useState([]);
  const [newStatusId, setNewStatusId] = useState(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [{ data: repData }, { data: statutsData }, { data: historyData }] = await Promise.all([
      supabase
        .from('reparations')
        .select(`
          id_reparation, numero_suivi, description_panne, date_prise_en_charge, id_statut_actuel,
          statuts ( libelle ),
          appareils ( marque, modele, clients ( nom, prenom, telephone ) )
        `)
        .eq('id_reparation', repairId)
        .single(),
      supabase.from('statuts').select('*').order('id_statut', { ascending: true }),
      supabase
        .from('historique_statuts')
        .select('*, statuts(libelle), employes(prenom, nom)')
        .eq('id_reparation', repairId)
        .order('date_changement', { ascending: false })
    ]);

    setRepair(repData);
    setStatuts(statutsData || []);
    setHistory(historyData || []);
    setNewStatusId(repData?.id_statut_actuel ?? null);
    setLoading(false);
  }, [repairId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('reparations')
        .update({ id_statut_actuel: newStatusId })
        .eq('id_reparation', repairId);
      if (updateError) throw updateError;

      if (comment.trim() !== '') {
        const { data: latestHistory } = await supabase
          .from('historique_statuts')
          .select('id_historique')
          .eq('id_reparation', repairId)
          .order('date_changement', { ascending: false })
          .limit(1)
          .single();

        if (latestHistory) {
          await supabase.from('historique_statuts').update({ commentaire: comment }).eq('id_historique', latestHistory.id_historique);
        }
      }

      setComment('');
      await fetchAll();
      Alert.alert('Mis à jour', 'Le statut de la réparation a été enregistré.');
    } catch (err) {
      Alert.alert('Erreur', err.message || "La mise à jour a échoué.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !repair) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const noChange = repair.id_statut_actuel === newStatusId && comment.trim() === '';

  return (
    <ScrollView className="flex-1 bg-slate-50 px-4 pt-4">
      <TouchableOpacity onPress={() => navigation.goBack()} className="mb-3">
        <Text className="text-blue-600 font-semibold">← Retour</Text>
      </TouchableOpacity>

      <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <Text className="font-mono text-xs font-bold text-slate-500">#{repair.numero_suivi}</Text>
        <Text className="text-xl font-extrabold text-slate-800 mt-1">{repair.appareils?.marque} {repair.appareils?.modele}</Text>
        <View className="mt-2">
          <StatusBadge idStatut={repair.id_statut_actuel} label={repair.statuts?.libelle} />
        </View>
      </View>

      <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <Text className="text-xs font-bold text-slate-400 uppercase mb-2">Panne signalée</Text>
        <Text className="text-slate-700">{repair.description_panne}</Text>
      </View>

      <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <Text className="text-xs font-bold text-slate-400 uppercase mb-2">Client</Text>
        <Text className="text-slate-700 font-semibold">{repair.appareils?.clients?.prenom} {repair.appareils?.clients?.nom}</Text>
        <Text className="text-slate-500 text-sm">{repair.appareils?.clients?.telephone}</Text>
      </View>

      <View className="bg-blue-50 rounded-2xl border border-blue-100 p-4 mb-4">
        <Text className="text-blue-800 font-bold mb-2">Mettre à jour l'intervention</Text>
        <Text className="text-xs font-semibold text-slate-600 mb-1">Nouveau statut</Text>
        <View className="bg-white border border-slate-300 rounded-lg mb-3 overflow-hidden" style={{ height: 48, justifyContent: 'center' }}>
          <Picker selectedValue={newStatusId} onValueChange={setNewStatusId} style={{ marginTop: -8 }}>
            {statuts.map((s) => (
              <Picker.Item key={s.id_statut} label={s.libelle} value={s.id_statut} />
            ))}
          </Picker>
        </View>
        <Text className="text-xs font-semibold text-slate-600 mb-1">Commentaire (visible par le client)</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Ex : Écran commandé, réception prévue mardi..."
          multiline
          className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[80px] mb-3"
        />
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || noChange}
          className={`rounded-lg py-3 items-center ${saving || noChange ? 'bg-blue-300' : 'bg-blue-600'}`}
        >
          <Text className="text-white font-bold">{saving ? 'Enregistrement...' : 'Valider la mise à jour'}</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-xs font-bold text-slate-400 uppercase mb-2">Historique</Text>
      {history.map((h) => (
        <View key={h.id_historique} className="bg-white rounded-xl border border-slate-200 p-3 mb-2">
          <View className="flex-row justify-between items-center mb-1">
            <StatusBadge idStatut={h.id_statut} label={h.statuts?.libelle} />
            <Text className="text-[11px] text-slate-400 font-mono">
              {new Date(h.date_changement).toLocaleDateString('fr-FR')}
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
