import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../supabaseClient';

// Port de promptPasswordChange (TechDashboard.jsx web) : même appel Supabase
// (`auth.updateUser` + `must_change_password: false`), applicable à tous les rôles
// puisque tout compte créé par un admin/manager passe par le même flag.
// `forced` = première connexion : non annulable (comme le web, allowOutsideClick:false).
export default function PasswordChangeModal({ visible, forced = false, onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setPassword('');
    setConfirm('');
  };

  const handleSubmit = async () => {
    if (password.length < 6) {
      Alert.alert('Mot de passe trop court', 'Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Les mots de passe ne correspondent pas', 'Merci de vérifier la confirmation.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
      if (error) throw error;
      reset();
      Alert.alert('Mot de passe enregistré', 'Votre mot de passe a bien été mis à jour.', [{ text: 'OK', onPress: onClose }]);
    } catch (err) {
      Alert.alert('Erreur', err.message || 'La mise à jour a échoué.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!forced) onClose?.(); }}>
      <View className="flex-1 items-center justify-center bg-black/40 p-6">
        <View className="bg-white rounded-2xl p-6 w-full">
          <Text className="text-lg font-bold text-slate-800 mb-1">{forced ? 'Première connexion 🔐' : 'Changer mon mot de passe'}</Text>
          <Text className="text-sm text-slate-500 mb-4">
            {forced ? 'Pour sécuriser votre compte, définissez votre mot de passe personnel.' : 'Saisissez votre nouveau mot de passe (6 caractères minimum).'}
          </Text>
          <TextInput
            secureTextEntry
            placeholder="Nouveau mot de passe"
            value={password}
            onChangeText={setPassword}
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm mb-3"
          />
          <TextInput
            secureTextEntry
            placeholder="Confirmer le mot de passe"
            value={confirm}
            onChangeText={setConfirm}
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm mb-4"
          />
          <View className="flex-row gap-2">
            {!forced && (
              <TouchableOpacity onPress={() => { reset(); onClose?.(); }} className="flex-1 bg-slate-100 rounded-lg py-3 items-center">
                <Text className="text-slate-600 font-bold text-sm">Annuler</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleSubmit} disabled={submitting} className={`flex-1 rounded-lg py-3 items-center ${submitting ? 'bg-blue-300' : 'bg-blue-600'}`}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-sm">Enregistrer</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
