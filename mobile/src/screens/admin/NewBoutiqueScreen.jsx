import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../supabaseClient';

// Port de handleAddBoutique (AdminDashboard.jsx web) : mêmes champs, coordonnées par défaut sur Paris.
export default function NewBoutiqueScreen({ navigation }) {
  const [form, setForm] = useState({ nom: '', ville: '', adresse: '', latitude: '48.8566', longitude: '2.3522' });
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const isValid = form.nom && form.ville && form.adresse;

  const handleSubmit = async () => {
    if (!isValid) {
      Alert.alert('Formulaire incomplet', 'Merci de remplir le nom, la ville et l’adresse.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('boutiques').insert([{
        nom: form.nom,
        ville: form.ville,
        adresse: form.adresse,
        latitude: parseFloat(form.latitude) || 48.8566,
        longitude: parseFloat(form.longitude) || 2.3522
      }]);
      if (error) throw error;
      Alert.alert('Boutique créée', '', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert('Erreur', err.message || 'La création de la boutique a échoué.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View className="bg-white rounded-2xl border border-slate-200 p-4">
          <Text className="text-xs font-semibold text-slate-500 mb-1">Nom</Text>
          <TextInput placeholder="FiXeo - République" value={form.nom} onChangeText={(v) => update('nom', v)} className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm mb-3" />

          <View className="flex-row gap-2 mb-3">
            <View className="flex-1">
              <Text className="text-xs font-semibold text-slate-500 mb-1">Ville</Text>
              <TextInput placeholder="Paris" value={form.ville} onChangeText={(v) => update('ville', v)} className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold text-slate-500 mb-1">Adresse</Text>
              <TextInput placeholder="12 rue de la République" value={form.adresse} onChangeText={(v) => update('adresse', v)} className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            </View>
          </View>

          <Text className="text-xs font-semibold text-slate-500 mb-1">Coordonnées (pour la carte)</Text>
          <View className="flex-row gap-2">
            <TextInput placeholder="Latitude" keyboardType="numeric" value={form.latitude} onChangeText={(v) => update('latitude', v)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            <TextInput placeholder="Longitude" keyboardType="numeric" value={form.longitude} onChangeText={(v) => update('longitude', v)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          </View>
        </View>

        <TouchableOpacity onPress={handleSubmit} disabled={submitting} className={`rounded-xl py-4 items-center mt-4 shadow-sm ${submitting ? 'bg-blue-300' : 'bg-blue-600'}`}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-extrabold text-base">Créer la boutique</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
