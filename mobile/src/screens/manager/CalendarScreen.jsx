import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import EmployeeCalendar from '../../components/calendar/EmployeeCalendar';
import TeamAvailabilityGrid from '../../components/calendar/TeamAvailabilityGrid';

export default function CalendarScreen() {
  const { userData, role } = useAuth();
  const [tab, setTab] = useState('mine');
  const [teamIds, setTeamIds] = useState([]);
  const [techniciens, setTechniciens] = useState([]);

  useEffect(() => {
    if (!userData?.id_boutique) return;
    supabase.from('employes').select('id_employe').eq('id_boutique', userData.id_boutique).then(({ data }) => {
      setTeamIds((data || []).map((e) => e.id_employe));
    });
    supabase.from('employes').select('id_employe, prenom, nom, avatar_url').eq('role', 'Technicien').eq('id_boutique', userData.id_boutique).then(({ data }) => {
      setTechniciens(data || []);
    });
  }, [userData?.id_boutique]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-extrabold text-slate-800">Calendrier</Text>
      </View>

      <View className="flex-row px-5 mb-4 gap-2">
        <TouchableOpacity
          onPress={() => setTab('mine')}
          className={`flex-1 py-2.5 rounded-full items-center ${tab === 'mine' ? 'bg-blue-600' : 'bg-white border border-slate-200'}`}
        >
          <Text className={`text-sm font-bold ${tab === 'mine' ? 'text-white' : 'text-slate-600'}`}>Mon calendrier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab('team')}
          className={`flex-1 py-2.5 rounded-full items-center ${tab === 'team' ? 'bg-blue-600' : 'bg-white border border-slate-200'}`}
        >
          <Text className={`text-sm font-bold ${tab === 'team' ? 'text-white' : 'text-slate-600'}`}>Planning équipe</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        {tab === 'mine' && userData && (
          <EmployeeCalendar
            employeId={userData.id_employe}
            employeName={`${userData.prenom} ${userData.nom}`}
            viewerRole={role}
            boutiqueEmployeIds={teamIds}
          />
        )}
        {tab === 'team' && <TeamAvailabilityGrid employees={techniciens} />}
      </ScrollView>
    </SafeAreaView>
  );
}
