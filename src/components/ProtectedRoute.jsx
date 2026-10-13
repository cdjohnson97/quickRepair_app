import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, mfaVerified, loading } = useAuth();

  // 1. Pendant qu'on vérifie l'identité, on affiche un petit chargement
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 2. Si l'utilisateur n'est pas connecté, ou n'a pas encore saisi son code de double
  //    authentification (session au mot de passe seul) -> direction le Login
  if (!user || !mfaVerified) {
    return <Navigate to="/login" replace />;
  }

  // 3. Si l'utilisateur est connecté mais n'a pas le bon rôle autorisé -> on bloque
  if (allowedRoles && !allowedRoles.includes(role)) {
    // On le renvoie vers la page de connexion (ou une page 403 Non Autorisé)
    return <Navigate to="/login" replace />; 
  }

  // 4. Si tout est bon, on affiche la page demandée
  return children;
}