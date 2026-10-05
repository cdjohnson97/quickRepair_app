import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { apiClient, setApiToken } from '../../apiClient';

// Importation des icônes corrigées (FiSmartphone remplace FiLaptop)
import { FiPhone, FiSmartphone, FiBatteryCharging, FiTablet, FiMonitor, FiTool } from 'react-icons/fi';
import { HiOutlineUserCircle, HiOutlineKey } from 'react-icons/hi';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Authentification via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      const userEmail = authData.user.email;

      // 1bis. Récupère un JWT du backend NestJS (module Réparations) — même mot de
      // passe, vérifié côté serveur contre le même hash bcrypt Supabase. Non bloquant :
      // si le backend est indisponible, l'app continue de fonctionner sur Supabase seul
      // (messagerie/présence/calendrier), seul le module Réparations serait affecté.
      try {
        const { data: apiAuth } = await apiClient.post('/auth/login', { email, password });
        setApiToken(apiAuth.access_token);
      } catch (apiErr) {
        console.error("Connexion au backend Réparations impossible :", apiErr.message);
      }

      // 2. Vérification du rôle dans notre table "employes"
      // 2. Vérification du rôle dans notre table "employes"
      const { data: employe, error: empError } = await supabase
        .from('employes')
        .select('role')
        .eq('email', userEmail)
        .single();

      if (employe) {
        // ON AJOUTE L'ADMINISTRATEUR ICI 
        if (employe.role === 'Administrateur') {
          navigate('/admin');
        } else if (employe.role === 'Responsable') {
          navigate('/manager');
        } else if (employe.role === 'Technicien') {
          navigate('/technicien');
        } else {
          navigate('/manager'); 
        }
      } else {
        navigate('/client');
      }

    } catch (err) {
      console.error("Erreur de connexion:", err.message);
      setError("Identifiants incorrects. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 px-4 relative overflow-hidden">

      {/* ------------------------------------------------------------ */}
      {/* Motif d'arrière-plan (Watermark Moderne) */}
      <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.06] text-slate-900 dark:text-white pointer-events-none grid grid-cols-4 md:grid-cols-6 gap-16 p-12 lg:grid-cols-8">
        <FiPhone className="text-9xl -rotate-12" />
        <FiSmartphone className="text-8xl rotate-12 col-start-2 row-start-2" />
        <FiBatteryCharging className="text-9xl rotate-45 col-start-4 row-start-1" />
        <FiTablet className="text-7xl -rotate-45 col-start-3 row-start-3" />
        <FiMonitor className="text-8xl rotate-12 col-start-5 row-start-2" />
        <FiTool className="text-9xl -rotate-12 col-start-1 row-start-4" />
        <FiPhone className="text-7xl rotate-45 col-start-6 row-start-4" />
        <FiSmartphone className="text-9xl -rotate-12 col-start-4 row-start-4" />
        <FiBatteryCharging className="text-8xl rotate-12 col-start-2 row-start-5" />
        <FiTablet className="text-9xl -rotate-45 col-start-5 row-start-5" />
      </div>
      {/* ------------------------------------------------------------ */}

      {/* Carte de login par-dessus le motif (z-10) */}
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden relative z-10 border border-slate-200/50 dark:border-slate-700">
        
        {/* En-tête de la carte */}
        <div className="bg-blue-600 p-8 text-center">
          <h2 className="text-4xl font-extrabold text-white tracking-tight">QuickRepair</h2>
          <p className="text-blue-100 mt-2 font-medium">Portail de connexion sécurisé</p>
        </div>

        {/* Formulaire */}
        <div className="p-8">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-4 rounded-lg text-sm mb-6 border border-red-200 dark:border-red-800">
              <span className="font-bold">Erreur : </span>{error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Adresse Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <HiOutlineUserCircle className="text-xl" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="jean.dupont@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <HiOutlineKey className="text-xl" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition duration-200 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Connexion en cours...' : 'Se connecter au portail'}
            </button>
          </form>
          
          <div className="mt-8 text-center text-xs text-gray-400 dark:text-slate-500 border-t dark:border-slate-700 pt-6">
            © {new Date().getFullYear()} QuickRepair S.A.S. - Besoin d'aide ? Contactez l'administrateur.
          </div>
        </div>
      </div>
    </div>
  );
}