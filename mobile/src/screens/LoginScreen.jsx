import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

// Port visuel de src/pages/auth/login.jsx (web) : bandeau bleu "FiXeo" sur la
// carte, champs avec icône, watermark décoratif d'icônes réparation en fond — adapté
// en dégradés (expo-linear-gradient) plutôt qu'en Tailwind/DOM.
export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Champs requis', 'Merci de renseigner votre email et votre mot de passe.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      Alert.alert('Connexion impossible', err.message || 'Identifiants incorrects.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#1e3a8a', '#0f172a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.07 }}>
        <Feather name="tool" size={220} color="#fff" style={{ position: 'absolute', top: -30, left: -50, transform: [{ rotate: '-18deg' }] }} />
        <Feather name="smartphone" size={150} color="#fff" style={{ position: 'absolute', bottom: 60, right: -20, transform: [{ rotate: '15deg' }] }} />
        <Feather name="tablet" size={130} color="#fff" style={{ position: 'absolute', top: '42%', right: 20, transform: [{ rotate: '-10deg' }] }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="bg-white rounded-3xl overflow-hidden" style={{ shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 10 }}>
            <LinearGradient colors={['#2563eb', '#1d4ed8']} style={{ paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center' }}>
              <View className="bg-white/15 w-16 h-16 rounded-2xl items-center justify-center mb-3">
                <Feather name="tool" size={28} color="#fff" />
              </View>
              <Text className="text-3xl font-extrabold text-white tracking-tight">FiXeo</Text>
              <Text className="text-blue-100 mt-1 text-sm font-medium">Portail de connexion sécurisé</Text>
            </LinearGradient>

            <View className="p-6">
              <Text className="text-xs font-bold text-slate-500 uppercase mb-1.5">Email</Text>
              <View className="flex-row items-center border border-slate-300 rounded-xl px-3 mb-4 bg-slate-50">
                <Feather name="mail" size={16} color="#94a3b8" />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="vous@fixeo.fr"
                  placeholderTextColor="#94a3b8"
                  className="flex-1 px-2 py-3 text-sm text-slate-800"
                />
              </View>

              <Text className="text-xs font-bold text-slate-500 uppercase mb-1.5">Mot de passe</Text>
              <View className="flex-row items-center border border-slate-300 rounded-xl px-3 mb-6 bg-slate-50">
                <Feather name="lock" size={16} color="#94a3b8" />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  className="flex-1 px-2 py-3 text-sm text-slate-800"
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                <LinearGradient
                  colors={loading ? ['#93c5fd', '#93c5fd'] : ['#2563eb', '#1d4ed8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: 'center',
                    shadowColor: '#1d4ed8',
                    shadowOpacity: 0.3,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 4
                  }}
                >
                  {loading ? (
                    <View className="flex-row items-center gap-2">
                      <ActivityIndicator color="#fff" size="small" />
                      <Text className="text-white font-bold">Connexion en cours...</Text>
                    </View>
                  ) : (
                    <Text className="text-white font-bold text-base">Se connecter</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <Text className="text-center text-[11px] text-slate-400 mt-6 pt-4 border-t border-slate-100">
                © {new Date().getFullYear()} FiXeo — Besoin d'aide ? Contactez l'administrateur.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
