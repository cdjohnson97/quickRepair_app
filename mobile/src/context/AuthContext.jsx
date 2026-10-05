import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

// Équivalent RN de src/context/AuthContext.jsx (web) : même forme (user, role, userData),
// pour que la logique de navigation/écrans reste directement transposable.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (authUser) => {
    if (!authUser) return;
    try {
      const { data: employe } = await supabase
        .from('employes')
        .select('*, boutiques ( nom, ville )')
        .eq('email', authUser.email)
        .maybeSingle();

      if (employe) {
        setRole(employe.role);
        setUserData(employe);
      } else {
        setRole('Client');
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du rôle:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUserData = () => {
    if (user) fetchUserRole(user);
  };

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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

  return (
    <AuthContext.Provider value={{ user, role, userData, loading, signIn, signOut, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
