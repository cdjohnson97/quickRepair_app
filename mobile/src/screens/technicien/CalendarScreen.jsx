import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import EmployeeCalendar from '../../components/calendar/EmployeeCalendar';

// Calendrier personnel du technicien (pas de "toute l'équipe" ni de planning équipe,
// réservés au manager côté EmployeeCalendar/CalendarScreen manager).
export default function TechCalendarScreen() {
  const { userData, role } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-extrabold text-slate-800">Mon calendrier</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        {userData && (
          <EmployeeCalendar
            employeId={userData.id_employe}
            employeName={`${userData.prenom} ${userData.nom}`}
            viewerRole={role}
            boutiqueEmployeIds={[]}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
