import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EVENT_TYPES, toISODate, addDays, fetchEventsForEmployees } from '../../utils/calendarEvents';

function startOfWeek(date) {
  const d = new Date(date);
  const weekday = (d.getDay() + 6) % 7;
  return addDays(d, -weekday);
}

const NAME_COL_WIDTH = 96;
const DAY_COL_WIDTH = 44;

// Port de src/components/calendar/TeamAvailabilityGrid.jsx (web) : planning hebdomadaire
// de toute l'équipe, une ligne par employé, une colonne par jour.
export default function TeamAvailabilityGrid({ employees }) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [events, setEvents] = useState([]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const ids = employees.map((e) => e.id_employe);

  useEffect(() => {
    if (ids.length === 0) return;
    let active = true;
    fetchEventsForEmployees(ids, days[0], days[6]).then((data) => {
      if (active) setEvents(data);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, employees.length]);

  if (employees.length === 0) return null;

  return (
    <View>
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={() => setWeekStart(addDays(weekStart, -7))} className="p-2">
          <Feather name="chevron-left" size={20} color="#64748b" />
        </TouchableOpacity>
        <Text className="font-bold text-slate-800 text-sm">Semaine du {days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</Text>
        <TouchableOpacity onPress={() => setWeekStart(addDays(weekStart, 7))} className="p-2">
          <Feather name="chevron-right" size={20} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View className="flex-row">
            <View style={{ width: NAME_COL_WIDTH }} />
            {days.map((d) => (
              <View key={toISODate(d)} style={{ width: DAY_COL_WIDTH }} className="items-center pb-2">
                <Text className="text-[10px] font-bold text-slate-400 uppercase">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</Text>
                <Text className="text-xs text-slate-500">{d.getDate()}</Text>
              </View>
            ))}
          </View>

          {employees.map((emp) => (
            <View key={emp.id_employe} className="flex-row items-center border-t border-slate-100 py-1.5">
              <Text style={{ width: NAME_COL_WIDTH }} className="text-xs font-semibold text-slate-700 pr-2" numberOfLines={1}>
                {emp.prenom} {emp.nom}
              </Text>
              {days.map((d) => {
                const iso = toISODate(d);
                const dayEvents = events.filter((e) => e.id_employe === emp.id_employe && e.date_debut <= iso && e.date_fin >= iso);
                const type = dayEvents[0]?.type;
                return (
                  <View key={iso} style={{ width: DAY_COL_WIDTH }} className="px-0.5">
                    <View className={`h-7 rounded-md ${type ? EVENT_TYPES[type]?.badge : 'bg-emerald-50'}`} />
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <View className="flex-row flex-wrap gap-3 mt-3">
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />
          <Text className="text-xs text-slate-500">Libre</Text>
        </View>
        {Object.entries(EVENT_TYPES).map(([key, val]) => (
          <View key={key} className="flex-row items-center gap-1.5">
            <View className={`w-3 h-3 rounded ${val.badge}`} />
            <Text className="text-xs text-slate-500">{val.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
