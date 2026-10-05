import { Text, View } from 'react-native';
import { getStatusBadgeColor } from '../constants/statuts';

export default function StatusBadge({ idStatut, label }) {
  return (
    <View className={`px-2.5 py-1 rounded-full self-start ${getStatusBadgeColor(idStatut)}`}>
      <Text className="text-[11px] font-bold uppercase">{label}</Text>
    </View>
  );
}
