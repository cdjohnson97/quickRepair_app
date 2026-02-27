import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/auth/login';
import { supabase } from './supabaseClient'; // Pour le bouton déconnexion
import ManagerDashboard from './pages/manager/ManagerDashboard';
import AdminDashboard from './pages/admin/AdminDashboard'; // À ajouter en haut
import TechDashboard from './pages/technicien/TechDashboard';
import ClientTracking from './pages/client/ClientTracking';
// --- Composants temporaires ---
const ClientDashboard = () => <div className="p-10 text-center text-2xl text-blue-600 font-bold">Espace Client</div>;
// const ManagerDashboard = () => <div className="p-10 text-center text-2xl text-purple-600 font-bold">Espace Manager</div>;

// --- Barre de navigation ---
// --- Barre de navigation ---
const NavBar = () => {
  const location = useLocation();
  // NOUVEAU : On récupère userData depuis le contexte
  const { role, userData } = useAuth(); 

  if (location.pathname === '/login' || location.pathname === '/') return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-md px-8 relative z-50">
      <div className="font-bold text-xl tracking-wider">QuickRepair</div>
      
      <div className="flex gap-6 items-center">
        {role === 'Client' && <span className="text-blue-300">Vue Client</span>}
        
        {role === 'Technicien' && (
          <div className="flex items-center gap-3 bg-slate-700/50 px-4 py-1.5 rounded-full border border-slate-600">
            <span className="text-green-400 font-medium">Atelier</span>
            <span className="w-px h-4 bg-slate-500"></span>
            <span className="text-slate-200 text-sm font-bold tracking-wide">
              {userData?.prenom} {userData?.nom} {/* Affichage du nom ! */}
            </span>
          </div>
        )}
        
        {role === 'Responsable' && <span className="text-purple-300">Vue Manager</span>}
        {role === 'Administrateur' && <span className="text-red-400 font-bold">Vue Admin Globale</span>}
        
        <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm">
          Déconnexion
        </button>
      </div>
    </nav>
  );
};

// --- Application Principale ---
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
          
          <NavBar />

          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />

            {/* ROUTES PROTÉGÉES ! */}
            <Route 
          path="/admin/*" 
          element={<ProtectedRoute allowedRoles={['Administrateur']}><AdminDashboard /></ProtectedRoute>} 
        />
        <Route 
              path="/client/*" 
              element={<ProtectedRoute allowedRoles={['Client']}><ClientDashboard /></ProtectedRoute>} 
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
    </AuthProvider>
  );
}

export default App;