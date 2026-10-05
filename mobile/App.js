import './global.css';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PresenceProvider } from './src/context/PresenceContext';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import PasswordChangeModal from './src/components/PasswordChangeModal';
import RootNavigator from './src/navigation/RootNavigator';

function AppContent() {
  const { user, userData } = useAuth();
  usePushNotifications(userData);
  const mustChangePassword = user?.user_metadata?.must_change_password === true;

  return (
    <>
      <RootNavigator />
      <PasswordChangeModal visible={mustChangePassword} forced />
      <StatusBar style="auto" />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PresenceProvider>
          <AppContent />
        </PresenceProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
