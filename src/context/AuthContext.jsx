import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [userData, setUserData] = useState(null); // NOUVEAU : On stocke les infos de l'employé
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (authUser) => {
    if (!authUser) return;
    try {
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
        fetchUserRole(session.user);
      } else {
        setRole(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // On expose userData au reste de l'application
  return (
    <AuthContext.Provider value={{ user, role, userData, loading, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);