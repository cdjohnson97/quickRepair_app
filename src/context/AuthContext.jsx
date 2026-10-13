import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { setApiToken } from '../apiClient';
import { disconnectSocket } from '../socketClient';
import { getMfaStatus } from '../utils/mfa';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [userData, setUserData] = useState(null); // NOUVEAU : On stocke les infos de l'employé
  // Double authentification obligatoire : tant que le code n'a pas été saisi (session aal1),
  // l'utilisateur n'a ni rôle ni accès aux tableaux de bord (voir ProtectedRoute).
  const [mfaVerified, setMfaVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (authUser) => {
    if (!authUser) return;
    try {
      const { verified } = await getMfaStatus();
      setMfaVerified(verified);
      if (!verified) {
        setRole(null);
        setUserData(null);
        return;
      }

      // ON SÉLECTIONNE TOUT (*) AU LIEU DE JUSTE LE RÔLE
      const { data: employe } = await supabase
        .from('employes')
        .select('*, boutiques ( nom, ville )')
        .eq('email', authUser.email)
        .maybeSingle();

      if (employe) {
        setRole(employe.role);
        setUserData(employe); // On sauvegarde prénom, nom, etc.
      } else {
        setRole('Client');
      }
    } catch (error) {
      console.error("Erreur lors de la récupération du rôle:", error);
    } finally {
      setLoading(false);
    }
  };

  // Permet de rafraîchir userData (ex: après changement de photo de profil) sans recharger la page.
  const refreshUserData = () => {
    if (user) fetchUserRole(user);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserRole(session.user);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        // Différé : appeler l'API auth de Supabase (getMfaStatus) directement dans ce rappel
        // peut bloquer le client (verrou de session tenu pendant la notification).
        setTimeout(() => fetchUserRole(session.user), 0);
      } else {
        // Déconnexion : on coupe aussi la session API et le socket, sinon le socket resterait
        // inscrit dans la room du compte précédent.
        setApiToken(null);
        disconnectSocket();
        setRole(null);
        setUserData(null);
        setMfaVerified(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // On expose userData au reste de l'application
  return (
    <AuthContext.Provider value={{ user, role, userData, mfaVerified, loading, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
