import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import StatusBadge from './StatusBadge';

// Carte de réparation réutilisée dans les listes Technicien et Manager.
export default function RepairCard({ repair, onPress, showTechnicien = false }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      className="bg-white rounded-2xl border border-slate-200 p-4 mb-3 shadow-sm"
      activeOpacity={0.7}
    >
      <View className="flex-row justify-between items-start mb-2">
        <Text className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
          #{repair.numero_suivi}
        </Text>
        <StatusBadge idStatut={repair.id_statut_actuel} label={repair.statuts?.libelle || 'Inconnu'} />
      </View>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-base font-bold text-slate-800">
            {repair.appareils?.marque} {repair.appareils?.modele}
          </Text>
          <Text className="text-sm text-slate-500 mt-1" numberOfLines={2}>
            {repair.description_panne}
          </Text>
          {showTechnicien && repair.employes && (
            <Text className="text-xs text-blue-600 font-semibold mt-2">
              👤 {repair.employes.prenom} {repair.employes.nom}
            </Text>
          )}
        </View>
        {onPress && <Feather name="chevron-right" size={18} color="#cbd5e1" />}
      </View>
    </TouchableOpacity>
  );
}
