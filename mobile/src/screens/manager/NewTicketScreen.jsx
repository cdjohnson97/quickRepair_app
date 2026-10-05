import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { addDays, toISODate, createEvent, fetchEventsForEmployees } from '../../utils/calendarEvents';
import { sendPushNotification } from '../../utils/pushNotifications';

const DUREES = [
  { label: '1 jour', value: '1' },
  { label: '2 jours', value: '2' },
  { label: '3 jours', value: '3' },
  { label: '5 jours', value: '5' }
];

// Port de handleSubmit dans ManagerDashboard.jsx (web) : client → appareil → réparation,
// puis bloc calendrier auto-créé + vérification de conflit + notification push au technicien.
export default function NewTicketScreen({ navigation }) {
  const { userData } = useAuth();
  const [techniciens, setTechniciens] = useState([]);
  const [teamEvents, setTeamEvents] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', telephone: '', marque: '', modele: '', description: '', id_technicien: null, duree: '1' });

  useEffect(() => {
    if (!userData?.id_boutique) return;
    supabase
      .from('employes')
      .select('id_employe, prenom, nom, push_token')
      .eq('role', 'Technicien')
      .eq('id_boutique', userData.id_boutique)
      .then(({ data }) => {
        setTechniciens(data || []);
        if (data && data.length > 0) {
          fetchEventsForEmployees(data.map((t) => t.id_employe), new Date(), addDays(new Date(), 90)).then(setTeamEvents);
        }
      });
  }, [userData?.id_boutique]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const isValid = form.nom && form.prenom && form.email && form.telephone && form.marque && form.modele && form.description && form.id_technicien;

  const createTicket = async () => {
    setSubmitting(true);
    try {
      let idClient;
      const { data: existingClient } = await supabase.from('clients').select('id_client').eq('email', form.email).maybeSingle();
      if (existingClient) {
        idClient = existingClient.id_client;
      } else {
        const { data: newClient, error: clientErr } = await supabase.from('clients').insert([{ nom: form.nom, prenom: form.prenom, email: form.email, telephone: form.telephone }]).select().single();
        if (clientErr) throw clientErr;
        idClient = newClient.id_client;
      }

      const { data: newAppareil, error: appErr } = await supabase.from('appareils').insert([{ id_client: idClient, marque: form.marque, modele: form.modele }]).select().single();
      if (appErr) throw appErr;

      const numeroSuivi = 'QR-' + Math.floor(Math.random() * 90000 + 10000);
      const { data: newRep, error: repErr } = await supabase
        .from('reparations')
        .insert([{ numero_suivi: numeroSuivi, description_panne: form.description, id_statut_actuel: 1, id_appareil: newAppareil.id_appareil, id_technicien: form.id_technicien }])
        .select()
        .single();
      if (repErr) throw repErr;

      const duree = parseInt(form.duree, 10) || 1;
      const dateDebut = new Date();
      const dateFin = addDays(dateDebut, duree - 1);

      try {
        await createEvent({ id_employe: form.id_technicien, titre: `Réparation ${numeroSuivi}`, type: 'reparation', date_debut: dateDebut, date_fin: dateFin, id_reparation: newRep.id_reparation });
      } catch (calErr) {
        console.error('Erreur bloc calendrier :', calErr.message);
      }

      const tech = techniciens.find((t) => t.id_employe === form.id_technicien);
      if (tech?.push_token) {
        sendPushNotification(tech.push_token, 'Nouveau ticket assigné 🛠️', `Ticket ${numeroSuivi} vous a été assigné.`, { type: 'repair', repairId: newRep.id_reparation });
      }

      Alert.alert('Ticket créé', `Numéro de suivi : ${numeroSuivi}`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert('Erreur', err.message || 'La création du ticket a échoué.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!isValid) {
      Alert.alert('Formulaire incomplet', 'Merci de remplir tous les champs.');
      return;
    }

    const duree = parseInt(form.duree, 10) || 1;
    const dateDebut = new Date();
    const dateFin = addDays(dateDebut, duree - 1);
    const hasConflict = teamEvents.some((ev) => ev.id_employe === form.id_technicien && ev.date_debut <= toISODate(dateFin) && ev.date_fin >= toISODate(dateDebut));

    if (hasConflict) {
      Alert.alert(
        'Technicien déjà occupé',
        'Ce technicien a déjà un événement sur cette période dans son calendrier. Assigner quand même ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Assigner quand même', onPress: createTicket }
        ]
      );
      return;
    }

    createTicket();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">1. Client</Text>
        <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
          <View className="flex-row gap-2 mb-2">
            <TextInput placeholder="Prénom" value={form.prenom} onChangeText={(v) => update('prenom', v)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            <TextInput placeholder="Nom" value={form.nom} onChangeText={(v) => update('nom', v)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          </View>
          <TextInput placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(v) => update('email', v)} className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm mb-2" />
          <TextInput placeholder="Téléphone" keyboardType="phone-pad" value={form.telephone} onChangeText={(v) => update('telephone', v)} className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
        </View>

        <Text className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">2. Appareil</Text>
        <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
          <View className="flex-row gap-2 mb-2">
            <TextInput placeholder="Marque" value={form.marque} onChangeText={(v) => update('marque', v)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            <TextInput placeholder="Modèle" value={form.modele} onChangeText={(v) => update('modele', v)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          </View>
          <TextInput
            placeholder="Description de la panne"
            value={form.description}
            onChangeText={(v) => update('description', v)}
            multiline
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm min-h-[80px]"
          />
        </View>

        <Text className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">3. Technicien</Text>
        <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
          <View className="flex-row flex-wrap gap-2 mb-3">
            {techniciens.map((t) => (
              <TouchableOpacity
                key={t.id_employe}
                onPress={() => update('id_technicien', t.id_employe)}
                className={`px-4 py-2 rounded-full border ${form.id_technicien === t.id_employe ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}
              >
                <Text className={`text-xs font-bold ${form.id_technicien === t.id_employe ? 'text-white' : 'text-slate-600'}`}>{t.prenom} {t.nom}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-xs font-semibold text-slate-600 mb-1">Durée estimée</Text>
          <View className="flex-row flex-wrap gap-2 mb-1">
            {DUREES.map((d) => (
              <TouchableOpacity
                key={d.value}
                onPress={() => update('duree', d.value)}
                className={`px-4 py-2 rounded-full border ${form.duree === d.value ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200'}`}
              >
                <Text className={`text-xs font-bold ${form.duree === d.value ? 'text-white' : 'text-slate-600'}`}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text className="text-[11px] text-slate-400 mt-1">Bloque automatiquement le calendrier du technicien pour cette durée.</Text>
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className={`rounded-xl py-4 items-center shadow-sm ${submitting ? 'bg-emerald-300' : 'bg-emerald-600'}`}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-extrabold text-base">Valider Ticket</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
