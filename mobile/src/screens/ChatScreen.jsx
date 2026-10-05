import { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../context/PresenceContext';
import MessageThread from '../components/MessageThread';
import Avatar from '../components/Avatar';

// Écran de conversation, partagé entre l'espace Technicien et l'espace Manager
// (seul le contact passé en paramètre de navigation change).
export default function ChatScreen({ route, navigation }) {
  const { contact } = route.params;
  const { userData } = useAuth();
  const { onlineIds } = useOnlineStatus();
  const online = onlineIds.has(contact.id_employe);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View className="flex-row items-center gap-2">
          <Avatar url={contact.avatar_url} name={`${contact.prenom} ${contact.nom}`} size={32} online={online} />
          <View>
            <Text className="font-bold text-slate-800">{contact.prenom} {contact.nom}</Text>
            <Text className={`text-[11px] ${online ? 'text-emerald-500 font-semibold' : 'text-slate-400'}`}>{online ? 'En ligne' : 'Hors ligne'}</Text>
          </View>
        </View>
      )
    });
  }, [navigation, contact, online]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-slate-50" keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <MessageThread
        currentUserId={userData.id_employe}
        otherUserId={contact.id_employe}
        otherUserName={`${contact.prenom} ${contact.nom}`}
        otherUserAvatar={contact.avatar_url}
      />
    </KeyboardAvoidingView>
  );
}
