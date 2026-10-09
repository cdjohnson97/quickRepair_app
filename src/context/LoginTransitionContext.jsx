import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthContext';
import LoginTransition from '../components/LoginTransition';

const LoginTransitionContext = createContext();

// Joue l'écran de transition après la connexion. Il reste affiché au-dessus des routes : on ne
// navigue vers le tableau de bord qu'une fois l'animation finie ET le profil chargé (AuthContext),
// puis l'écran s'efface en fondu sur le tableau de bord déjà rendu (pas de spinner intermédiaire).
export const LoginTransitionProvider = ({ children }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { loading: authLoading } = useAuth();
  const [target, setTarget] = useState(null); // { to, label }
  const [animDone, setAnimDone] = useState(false);

  const playLoginTransition = useCallback((to, label) => {
    setAnimDone(false);
    setTarget({ to, label });
  }, []);

  useEffect(() => {
    if (!target || !animDone || authLoading) return;
    // `navigate` change d'identité avec l'URL : sans ce test, l'effet relancé naviguerait deux fois.
    if (pathname !== target.to) navigate(target.to);
    // On laisse le tableau de bord s'afficher sous l'écran pendant une frame avant le fondu de sortie.
    const frame = requestAnimationFrame(() => setTarget(null));
    return () => cancelAnimationFrame(frame);
  }, [target, animDone, authLoading, navigate, pathname]);

  return (
    <LoginTransitionContext.Provider value={{ playLoginTransition }}>
      {children}
      <AnimatePresence>
        {target && <LoginTransition key="login-transition" label={target.label} onFinished={() => setAnimDone(true)} />}
      </AnimatePresence>
    </LoginTransitionContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- même organisation que AuthContext (provider + hook).
export const useLoginTransition = () => useContext(LoginTransitionContext);
