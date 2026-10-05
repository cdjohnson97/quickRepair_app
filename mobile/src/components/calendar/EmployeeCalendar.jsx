import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  EVENT_TYPES,
  MAX_RECURRING_OCCURRENCES,
  toISODate,
  addDays,
  formatDateRangeFr,
  fetchEventsForEmployees,
  createEvent,
  createEventsForTeam,
  updateEvent,
  deleteEvent
} from '../../utils/calendarEvents';
import DateField from '../DateField';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthGrid(monthDate) {
  const first = startOfMonth(monthDate);
  const firstWeekday = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -firstWeekday);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

const emptyForm = { id_evenement: null, titre: '', type: 'reparation', date_debut: '', date_fin: '', recurring: false, recurringUntil: '', applyToTeam: false };

function Checkbox({ checked, onToggle, label }) {
  return (
    <TouchableOpacity onPress={onToggle} className="flex-row items-center gap-2 py-1">
      <Feather name={checked ? 'check-square' : 'square'} size={18} color={checked ? '#2563eb' : '#94a3b8'} />
      <Text className="text-sm text-slate-600 flex-1">{label}</Text>
    </TouchableOpacity>
  );
}

// Port de src/components/calendar/EmployeeCalendar.jsx (web) : création/édition/suppression
// d'événements de disponibilité, même table `calendrier_evenements`.
export default function EmployeeCalendar({ employeId, employeName, viewerRole, boutiqueEmployeIds }) {
  const [monthDate, setMonthDate] = useState(startOfMonth(new Date()));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);

  const grid = buildMonthGrid(monthDate);
  const canApplyToTeam = viewerRole === 'Responsable' && boutiqueEmployeIds?.length > 1;
  const isEditing = Boolean(form?.id_evenement);

  useEffect(() => {
    if (!employeId) return;
    let active = true;
    setLoading(true);
    fetchEventsForEmployees([employeId], grid[0], grid[grid.length - 1]).then((data) => {
      if (active) {
        setEvents(data);
        setLoading(false);
      }
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeId, monthDate]);

  const eventsForDay = (day) => {
    const iso = toISODate(day);
    return events.filter((e) => e.date_debut <= iso && e.date_fin >= iso);
  };

  const openCreateForm = (day) => {
    const iso = toISODate(day);
    setForm({ ...emptyForm, date_debut: iso, date_fin: iso });
  };

  const openEditForm = (event) => {
    setForm({
      id_evenement: event.id_evenement,
      titre: event.titre,
      type: event.type,
      date_debut: event.date_debut,
      date_fin: event.date_fin,
      recurring: false,
      recurringUntil: '',
      applyToTeam: false
    });
  };

  const refresh = async () => {
    const data = await fetchEventsForEmployees([employeId], grid[0], grid[grid.length - 1]);
    setEvents(data);
  };

  const handleSubmitForm = async () => {
    if (!form.titre.trim()) return;

    try {
      if (isEditing) {
        await updateEvent(form.id_evenement, { titre: form.titre.trim(), type: form.type, date_debut: form.date_debut, date_fin: form.date_fin });
        setForm(null);
        refresh();
        return;
      }

      const occurrences = [{ date_debut: form.date_debut, date_fin: form.date_fin }];
      if (form.recurring && form.recurringUntil) {
        let start = new Date(form.date_debut);
        let end = new Date(form.date_fin);
        while (occurrences.length < MAX_RECURRING_OCCURRENCES) {
          start = addDays(start, 7);
          end = addDays(end, 7);
          if (toISODate(start) > form.recurringUntil) break;
          occurrences.push({ date_debut: toISODate(start), date_fin: toISODate(end) });
        }
      }

      for (const occ of occurrences) {
        if (form.applyToTeam && canApplyToTeam) {
          await createEventsForTeam(boutiqueEmployeIds, { titre: form.titre.trim(), type: form.type, ...occ });
        } else {
          await createEvent({ id_employe: employeId, titre: form.titre.trim(), type: form.type, ...occ });
        }
      }

      setForm(null);
      refresh();
    } catch (err) {
      Alert.alert('Erreur', err.message || "L'enregistrement de l'événement a échoué.");
    }
  };

  const handleDelete = (idEvenement) => {
    Alert.alert('Supprimer cet événement ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deleteEvent(idEvenement);
          refresh();
        }
      }
    ]);
  };

  const todayIso = toISODate(new Date());
  const upcoming = events.filter((e) => e.date_fin >= todayIso).sort((a, b) => a.date_debut.localeCompare(b.date_debut));

  return (
    <View>
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))} className="p-2">
          <Feather name="chevron-left" size={20} color="#64748b" />
        </TouchableOpacity>
        <Text className="font-bold text-slate-800 capitalize">{monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</Text>
        <TouchableOpacity onPress={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))} className="p-2">
          <Feather name="chevron-right" size={20} color="#64748b" />
        </TouchableOpacity>
      </View>

      <View className="flex-row flex-wrap">
        {WEEKDAYS.map((d, i) => (
          <View key={`${d}-${i}`} style={{ width: '14.28%' }} className="items-center mb-1">
            <Text className="text-[11px] font-bold text-slate-400 uppercase">{d}</Text>
          </View>
        ))}
        {grid.map((day) => {
          const inMonth = day.getMonth() === monthDate.getMonth();
          const dayEvents = eventsForDay(day);
          const isToday = toISODate(day) === todayIso;
          return (
            <TouchableOpacity
              key={toISODate(day)}
              onPress={() => openCreateForm(day)}
              style={{ width: '14.28%', aspectRatio: 1, padding: 2 }}
            >
              <View
                className={`flex-1 rounded-lg p-1 border ${inMonth ? 'bg-white border-slate-100' : 'bg-slate-50 border-transparent'} ${isToday ? 'border-blue-400 border-2' : ''}`}
              >
                <Text className={`text-[11px] font-semibold ${inMonth ? 'text-slate-700' : 'text-slate-300'}`}>{day.getDate()}</Text>
                <View className="flex-row flex-wrap gap-0.5 mt-1">
                  {dayEvents.slice(0, 3).map((e) => (
                    <View key={e.id_evenement} className={`w-1.5 h-1.5 rounded-full ${EVENT_TYPES[e.type]?.dot || EVENT_TYPES.autre.dot}`} />
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && <Text className="text-xs text-slate-400 italic mt-3">Chargement...</Text>}

      <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider mt-5 mb-2">Événements à venir</Text>
      {upcoming.length === 0 && <Text className="text-sm text-slate-400 italic">Aucun événement à venir.</Text>}
      {upcoming.map((e) => (
        <View key={e.id_evenement} className="flex-row items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mb-2">
          <View className="flex-row items-center gap-2 flex-1">
            <View className={`w-2 h-2 rounded-full ${EVENT_TYPES[e.type]?.dot || EVENT_TYPES.autre.dot}`} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-700">{e.titre}</Text>
              <Text className="text-xs text-slate-400">{formatDateRangeFr(e.date_debut, e.date_fin)}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => openEditForm(e)} className="p-1.5">
            <Feather name="edit-2" size={14} color="#94a3b8" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(e.id_evenement)} className="p-1.5">
            <Feather name="trash-2" size={14} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      ))}

      <Modal visible={!!form} transparent animationType="fade" onRequestClose={() => setForm(null)}>
        <View className="flex-1 items-center justify-center bg-black/30 p-6">
          <ScrollView className="bg-white rounded-2xl w-full max-h-[85%]" contentContainerStyle={{ padding: 20 }}>
            <Text className="font-bold text-slate-800 mb-3">{isEditing ? 'Modifier' : 'Nouvel'} événement — {employeName}</Text>
            <TextInput
              placeholder="Titre (ex: Réparation atelier B)"
              value={form?.titre}
              onChangeText={(text) => setForm({ ...form, titre: text })}
              className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm mb-3"
            />
            <Text className="text-xs font-semibold text-slate-500 mb-1">Type</Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {Object.entries(EVENT_TYPES).map(([key, val]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setForm({ ...form, type: key })}
                  className={`px-3 py-1.5 rounded-full border ${form?.type === key ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}
                >
                  <Text className={`text-xs font-bold ${form?.type === key ? 'text-white' : 'text-slate-600'}`}>{val.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-2 mb-3">
              <DateField label="Début" value={form?.date_debut} onChange={(v) => setForm({ ...form, date_debut: v })} />
              <DateField label="Fin" value={form?.date_fin} onChange={(v) => setForm({ ...form, date_fin: v })} minimumDate={form?.date_debut} />
            </View>

            {!isEditing && (
              <>
                <Checkbox checked={form?.recurring} onToggle={() => setForm({ ...form, recurring: !form.recurring })} label="Se répète chaque semaine" />
                {form?.recurring && (
                  <View className="mb-2">
                    <DateField label="Jusqu'au" value={form?.recurringUntil || form?.date_debut} onChange={(v) => setForm({ ...form, recurringUntil: v })} minimumDate={form?.date_debut} />
                  </View>
                )}
                {canApplyToTeam && (
                  <Checkbox checked={form?.applyToTeam} onToggle={() => setForm({ ...form, applyToTeam: !form.applyToTeam })} label="Appliquer à toute l'équipe de la boutique" />
                )}
              </>
            )}

            <View className="flex-row gap-2 mt-4">
              <TouchableOpacity onPress={() => setForm(null)} className="flex-1 bg-slate-100 rounded-lg py-3 items-center">
                <Text className="text-slate-600 font-bold text-sm">Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmitForm} className="flex-1 bg-blue-600 rounded-lg py-3 items-center">
                <Text className="text-white font-bold text-sm">{isEditing ? 'Enregistrer' : 'Créer'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
