import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../context/PresenceContext';
import { uploadAvatar } from '../utils/uploadAvatar';
import Avatar from '../components/Avatar';
import PasswordChangeModal from '../components/PasswordChangeModal';

export default function ProfileScreen() {
  const { user, userData, role, signOut, refreshUserData } = useAuth();
  const { onlineIds } = useOnlineStatus();
  const online = userData ? onlineIds.has(userData.id_employe) : false;
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorise l'accès à tes photos pour changer ton avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      await uploadAvatar({ localUri: result.assets[0].uri, authUid: user.id, idEmploye: userData.id_employe });
      refreshUserData();
    } catch (err) {
      Alert.alert('Erreur', err.message || "L'envoi de la photo a échoué.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-extrabold text-slate-800">Profil</Text>
      </View>

      <View className="px-5">
        <View className="bg-white rounded-2xl border border-slate-200 p-6 items-center shadow-sm">
          <View>
            <Avatar url={userData?.avatar_url} name={`${userData?.prenom} ${userData?.nom}`} size={84} online={online} />
            <TouchableOpacity
              onPress={handleChangePhoto}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 bg-blue-600 w-8 h-8 rounded-full items-center justify-center shadow-md"
            >
              {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="camera" size={14} color="#fff" />}
            </TouchableOpacity>
          </View>
          <Text className="text-lg font-bold text-slate-800 mt-3">{userData?.prenom} {userData?.nom}</Text>
          <View className="bg-blue-50 px-3 py-1 rounded-full mt-1">
            <Text className="text-xs font-bold text-blue-700 uppercase">{role}</Text>
          </View>
          {userData?.boutiques?.ville && (
            <Text className="text-xs text-slate-400 mt-3">Boutique de {userData.boutiques.ville}</Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => setShowPasswordModal(true)}
          className="flex-row items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl py-3.5 mt-4 shadow-sm"
        >
          <Feather name="lock" size={16} color="#2563eb" />
          <Text className="text-blue-600 font-bold">Changer mon mot de passe</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={signOut}
          className="flex-row items-center justify-center gap-2 bg-red-500 rounded-xl py-3.5 mt-3 shadow-sm"
        >
          <Feather name="log-out" size={16} color="#fff" />
          <Text className="text-white font-bold">Déconnexion</Text>
        </TouchableOpacity>
      </View>

      <PasswordChangeModal visible={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </SafeAreaView>
  );
}
