import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { supabase } from '../supabaseClient';
import { navigate } from '../navigation/navigationRef';

// Depuis le SDK 53, Expo Go ne supporte plus les notifications push distantes sur Android
// (il faut un "development build" — cf. https://docs.expo.dev/develop/development-builds/introduction/).
// Sur iOS, Expo Go les supporte toujours.
// IMPORTANT : le simple `import` statique de 'expo-notifications' déclenche déjà ce crash sur
// Android dans Expo Go (le module enregistre un listener de jeton push dès son chargement).
// On doit donc éviter tout `import`/`require` du module dans ce cas précis, pas seulement
// éviter d'appeler ses fonctions.
const isExpoGoAndroid = Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Enregistre le jeton push Expo de l'utilisateur connecté (employes.push_token) et
// gère la navigation quand on tape sur une notification reçue.
export function usePushNotifications(userData) {
  useEffect(() => {
    if (isExpoGoAndroid) {
      console.warn('Notifications push désactivées : non supportées sur Android dans Expo Go (SDK 53+). Fonctionnera dans un development build.');
      return;
    }
    if (!userData?.id_employe || !Device.isDevice) return;

    // eslint-disable-next-line global-require
    const Notifications = require('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false
      })
    });

    const register = async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.warn('Notifications push : projectId EAS manquant (lancer `npx eas init` dans mobile/).');
        return;
      }

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        await supabase.from('employes').update({ push_token: tokenData.data }).eq('id_employe', userData.id_employe);
      } catch (err) {
        console.warn('Impossible de récupérer le jeton push :', err.message);
      }
    };

    register();

    // Tap sur une notification : navigue vers l'onglet concerné. Pour un message, on ouvre
    // la liste des contacts ; pour une réparation assignée, l'id suffit à ouvrir le détail.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!data) return;

      if (data.type === 'message') {
        navigate('Messages');
      } else if (data.type === 'repair' && data.repairId) {
        navigate('Réparations', { screen: 'TechRepairDetail', params: { repairId: data.repairId } });
      }
    });

    return () => subscription.remove();
  }, [userData?.id_employe]);
}
