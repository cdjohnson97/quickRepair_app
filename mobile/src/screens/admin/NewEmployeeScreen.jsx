import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase, supabaseAdmin } from '../../supabaseClient';

const ROLES = ['Technicien', 'Responsable'];

// Port de handleAddUser (AdminDashboard.jsx web) : compte Auth (client isolé pour ne pas
// remplacer la session admin) + ligne dans `employes`, avec mot de passe temporaire à changer.
export default function NewEmployeeScreen({ route, navigation }) {
  const { boutique } = route.params;
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', telephone: '', role: 'Technicien', password: '' });
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const isValid = form.nom && form.prenom && form.email && form.telephone && form.password.length >= 6;

  const handleSubmit = async () => {
    if (form.password.length < 6) {
      Alert.alert('Mot de passe trop court', 'Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (!isValid) {
      Alert.alert('Formulaire incomplet', 'Merci de remplir tous les champs.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { prenom: form.prenom.trim(), nom: form.nom.trim(), role: form.role, must_change_password: true } }
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("L'identifiant de connexion n'a pas pu être généré.");

      const { error: dbError } = await supabase.from('employes').insert([{
        id_auth: authData.user.id,
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email.trim(),
        telephone: form.telephone.trim(),
        role: form.role,
        id_boutique: boutique.id_boutique
      }]);
      if (dbError) throw dbError;

      Alert.alert('Employé créé', `Mot de passe temporaire : ${form.password}`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      const isRateLimit = err.status === 429 || err.message?.toLowerCase().includes('rate limit');
      Alert.alert(
        isRateLimit ? 'Trop de requêtes' : 'Erreur de création',
        isRateLimit ? "Supabase limite le nombre d'inscriptions par heure. Réessaie dans quelques minutes." : err.message
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View className="bg-white rounded-2xl border border-slate-200 p-4">
          <View className="flex-row gap-2 mb-3">
            <TextInput placeholder="Prénom" value={form.prenom} onChangeText={(v) => update('prenom', v)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            <TextInput placeholder="Nom" value={form.nom} onChangeText={(v) => update('nom', v)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          </View>
          <TextInput placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(v) => update('email', v)} className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm mb-3" />
          <TextInput placeholder="Téléphone" keyboardType="phone-pad" value={form.telephone} onChangeText={(v) => update('telephone', v)} className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm mb-3" />

          <Text className="text-xs font-semibold text-slate-500 mb-1">Rôle</Text>
          <View className="flex-row gap-2 mb-3">
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => update('role', r)}
                className={`flex-1 py-2.5 rounded-lg items-center border ${form.role === r ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}
              >
                <Text className={`text-sm font-bold ${form.role === r ? 'text-white' : 'text-slate-600'}`}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-xs font-semibold text-slate-500 mb-1">Mot de passe temporaire</Text>
          <TextInput placeholder="6 caractères minimum" secureTextEntry value={form.password} onChangeText={(v) => update('password', v)} className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
        </View>

        <TouchableOpacity onPress={handleSubmit} disabled={submitting} className={`rounded-xl py-4 items-center mt-4 shadow-sm ${submitting ? 'bg-blue-300' : 'bg-blue-600'}`}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-extrabold text-base">Créer l'employé</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
