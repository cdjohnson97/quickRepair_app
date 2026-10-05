import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUnreadMessagesCount } from '../hooks/useUnreadMessagesCount';
import { navigationRef } from './navigationRef';
import LoginScreen from '../screens/LoginScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChatScreen from '../screens/ChatScreen';
import TechRepairListScreen from '../screens/technicien/RepairListScreen';
import TechRepairDetailScreen from '../screens/technicien/RepairDetailScreen';
import TechMessagesScreen from '../screens/technicien/MessagesScreen';
import TechCalendarScreen from '../screens/technicien/CalendarScreen';
import ManagerRepairListScreen from '../screens/manager/RepairListScreen';
import ManagerRepairDetailScreen from '../screens/manager/RepairDetailScreen';
import NewTicketScreen from '../screens/manager/NewTicketScreen';
import InvoiceScreen from '../screens/manager/InvoiceScreen';
import TeamScreen from '../screens/manager/TeamScreen';
import TechnicianDetailScreen from '../screens/manager/TechnicianDetailScreen';
import ManagerMessagesScreen from '../screens/manager/MessagesScreen';
import CalendarScreen from '../screens/manager/CalendarScreen';
import BoutiquesScreen from '../screens/admin/BoutiquesScreen';
import NewBoutiqueScreen from '../screens/admin/NewBoutiqueScreen';
import BoutiqueTeamScreen from '../screens/admin/BoutiqueTeamScreen';
import NewEmployeeScreen from '../screens/admin/NewEmployeeScreen';
import EmployeeDetailScreen from '../screens/admin/EmployeeDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Les écrans de liste ont leur propre en-tête stylé dans le contenu de l'écran
// (SafeAreaView + titre) : on masque l'en-tête natif pour éviter le doublon, et on
// le garde uniquement sur Détail/Chat où le bouton retour natif est utile.
const stackScreenOptions = { headerBackButtonDisplayMode: 'minimal' };

// Bouton retour explicite (icône seule) : plus fiable d'un écran à l'autre que de compter
// sur le comportement par défaut du header natif, qui varie selon la plateforme/version.
function BackButton({ navigation }) {
  return (
    <TouchableOpacity onPress={() => navigation.goBack()} className="pr-3 py-1 -ml-1">
      <Feather name="chevron-left" size={26} color="#2563eb" />
    </TouchableOpacity>
  );
}

function withBackButton(title) {
  return ({ navigation }) => ({ title, headerLeft: () => <BackButton navigation={navigation} /> });
}

function TechnicienRepairStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="TechRepairList" component={TechRepairListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TechRepairDetail" component={TechRepairDetailScreen} options={withBackButton('Détail')} />
    </Stack.Navigator>
  );
}

function TechnicienMessagesStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="TechMessagesList" component={TechMessagesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={withBackButton('')} />
    </Stack.Navigator>
  );
}

function ManagerMessagesStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ManagerMessagesList" component={ManagerMessagesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={withBackButton('')} />
    </Stack.Navigator>
  );
}

function ManagerRepairStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ManagerRepairList" component={ManagerRepairListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ManagerRepairDetail" component={ManagerRepairDetailScreen} options={withBackButton('Détail')} />
      <Stack.Screen name="NewTicket" component={NewTicketScreen} options={withBackButton('Nouveau ticket')} />
      <Stack.Screen name="Invoice" component={InvoiceScreen} options={withBackButton('Facturation')} />
    </Stack.Navigator>
  );
}

function ManagerTeamStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="TeamList" component={TeamScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TechnicianDetail" component={TechnicianDetailScreen} options={withBackButton('Technicien')} />
    </Stack.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="BoutiquesList" component={BoutiquesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NewBoutique" component={NewBoutiqueScreen} options={withBackButton('Nouvelle boutique')} />
      <Stack.Screen name="BoutiqueTeam" component={BoutiqueTeamScreen} options={withBackButton('Équipe')} />
      <Stack.Screen name="NewEmployee" component={NewEmployeeScreen} options={withBackButton('Nouvel employé')} />
      <Stack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} options={withBackButton('Employé')} />
    </Stack.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Boutiques"
        component={AdminStack}
        options={{ tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

function TechnicienTabs() {
  const { userData } = useAuth();
  const unread = useUnreadMessagesCount(userData?.id_employe);

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Réparations"
        component={TechnicienRepairStack}
        options={{ tabBarIcon: ({ color, size }) => <Feather name="tool" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Calendrier"
        component={TechCalendarScreen}
        options={{ tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Messages"
        component={TechnicienMessagesStack}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="message-square" size={size} color={color} />,
          tabBarBadge: unread > 0 ? unread : undefined
        }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

function ManagerTabs() {
  const { userData } = useAuth();
  const unread = useUnreadMessagesCount(userData?.id_employe);

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Réparations"
        component={ManagerRepairStack}
        options={{ tabBarIcon: ({ color, size }) => <Feather name="tool" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Équipe"
        component={ManagerTeamStack}
        options={{ tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Calendrier"
        component={CalendarScreen}
        options={{ tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Messages"
        component={ManagerMessagesStack}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="message-square" size={size} color={color} />,
          tabBarBadge: unread > 0 ? unread : undefined
        }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {!user || !role || role === 'Client' ? (
        <LoginScreen />
      ) : role === 'Technicien' ? (
        <TechnicienTabs />
      ) : role === 'Responsable' ? (
        <ManagerTabs />
      ) : role === 'Administrateur' ? (
        <AdminTabs />
      ) : (
        <LoginScreen />
      )}
    </NavigationContainer>
  );
}
