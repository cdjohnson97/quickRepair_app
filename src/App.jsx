import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { PresenceProvider, useOnlineStatus } from './context/PresenceContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/auth/login';
import { supabase } from './supabaseClient'; // Pour le bouton déconnexion
import { setApiToken } from './apiClient';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import AdminDashboard from './pages/admin/AdminDashboard'; // À ajouter en haut
import TechDashboard from './pages/technicien/TechDashboard';
import ClientTracking from './pages/client/ClientTracking';
import { FiSun, FiMoon, FiCalendar, FiX } from 'react-icons/fi';
import Avatar from './components/Avatar';
import ProfileModal from './components/ProfileModal';
import EmployeeCalendar from './components/calendar/EmployeeCalendar';

// --- Bouton flottant de bascule de thème (visible sur toutes les pages) ---
const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
      className="fixed bottom-6 right-6 z-[3000] w-12 h-12 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
    >
      {theme === 'dark' ? <FiSun className="text-xl text-amber-400" /> : <FiMoon className="text-xl text-slate-600" />}
    </button>
  );
};

// --- Avatar cliquable ouvrant la modale "Mon profil" ---
const ProfileButton = ({ userData, isOnline, onClick }) => (
  <button onClick={onClick} title="Mon profil" className="shrink-0">
    <Avatar url={userData?.avatar_url} name={`${userData?.prenom} ${userData?.nom}`} size={28} online={isOnline} />
  </button>
);

// --- Bouton + modale "Mon calendrier" ---
const CalendarButton = ({ onClick }) => (
  <button onClick={onClick} title="Mon calendrier" className="text-slate-300 hover:text-white transition">
    <FiCalendar />
  </button>
);

const CalendarModal = ({ isOpen, onClose, userData, role }) => {
  const [teamIds, setTeamIds] = useState([]);

  useEffect(() => {
    if (!isOpen || role !== 'Responsable' || !userData?.id_boutique) return;
    supabase.from('employes').select('id_employe').eq('id_boutique', userData.id_boutique).then(({ data }) => {
      setTeamIds((data || []).map((e) => e.id_employe));
    });
  }, [isOpen, role, userData?.id_boutique]);

  if (!isOpen || !userData) return null;

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">Mon calendrier</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition"><FiX /></button>
        </div>
        <EmployeeCalendar
          employeId={userData.id_employe}
          employeName={`${userData.prenom} ${userData.nom}`}
          viewerRole={role}
          boutiqueEmployeIds={teamIds}
        />
      </div>
    </div>
  );
};

// --- Barre de navigation ---
// --- Barre de navigation ---
const NavBar = () => {
  const location = useLocation();
  // NOUVEAU : On récupère userData depuis le contexte
  const { role, userData } = useAuth();
  const { onlineIds } = useOnlineStatus();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  if (location.pathname === '/login' || location.pathname === '/' || location.pathname === '/client') return null;

  const handleLogout = async () => {
    setApiToken(null);
    await supabase.auth.signOut();
  };

  const isOnline = userData ? onlineIds.has(userData.id_employe) : undefined;

  return (
    <nav className="bg-slate-800 dark:bg-slate-950 text-white p-4 flex justify-between items-center shadow-md px-8 sticky top-0 z-50">
      <div className="font-bold text-xl tracking-wider">QuickRepair</div>

      <div className="flex gap-6 items-center">
        {role === 'Client' && <span className="text-blue-300">Vue Client</span>}

        {role === 'Technicien' && (
          <div className="flex items-center gap-3 bg-slate-700/50 px-4 py-1.5 rounded-full border border-slate-600">
            <ProfileButton userData={userData} isOnline={isOnline} onClick={() => setIsProfileOpen(true)} />
            <span className="text-green-400 font-medium">{userData?.boutiques?.ville || 'Atelier'}</span>
            <span className="w-px h-4 bg-slate-500"></span>
            <span className="text-slate-200 text-sm font-bold tracking-wide">
              {userData?.prenom} {userData?.nom} {/* Affichage du nom ! */}
            </span>
            <span className="w-px h-4 bg-slate-500"></span>
            <CalendarButton onClick={() => setIsCalendarOpen(true)} />
          </div>
        )}

        {role === 'Responsable' && (
          <div className="flex items-center gap-3 bg-slate-700/50 px-4 py-1.5 rounded-full border border-slate-600">
            <ProfileButton userData={userData} isOnline={isOnline} onClick={() => setIsProfileOpen(true)} />
            <span className="text-purple-300 font-medium">Manager</span>
            <span className="w-px h-4 bg-slate-500"></span>
            <span className="text-slate-200 text-sm font-bold tracking-wide">
              {userData?.prenom} {userData?.nom}
            </span>
            <span className="w-px h-4 bg-slate-500"></span>
            <CalendarButton onClick={() => setIsCalendarOpen(true)} />
          </div>
        )}
        {role === 'Administrateur' && (
          <div className="flex items-center gap-3">
            <ProfileButton userData={userData} isOnline={isOnline} onClick={() => setIsProfileOpen(true)} />
            <span className="text-red-400 font-bold">Vue Admin Globale</span>
          </div>
        )}

        <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm">
          Déconnexion
        </button>
      </div>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <CalendarModal isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} userData={userData} role={role} />
    </nav>
  );
};

// --- Application Principale ---
function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
    <PresenceProvider>
      <Router>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors">

          <NavBar />
          <ThemeToggle />

          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />

            {/* ROUTES PROTÉGÉES ! */}
            <Route 
          path="/admin/*" 
          element={<ProtectedRoute allowedRoles={['Administrateur']}><AdminDashboard /></ProtectedRoute>} 
        />
        <Route
              path="/technicien/*" 
              element={<ProtectedRoute allowedRoles={['Technicien', 'Responsable']}><TechDashboard /></ProtectedRoute>} 
            />
            
            <Route 
              path="/manager/*" 
              element={<ProtectedRoute allowedRoles={['Responsable']}><ManagerDashboard /></ProtectedRoute>} 
            />
            <Route path="/client" element={<ClientTracking />} />
            
            <Route path="*" element={<div className="p-10 text-center text-red-500 text-xl font-bold">404 - Page introuvable</div>} />
          </Routes>

          

        </div>
      </Router>
    </PresenceProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;