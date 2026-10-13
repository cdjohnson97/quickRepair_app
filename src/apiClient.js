import axios from 'axios';
import { supabase } from './supabaseClient';
import { disconnectSocket } from './socketClient';

// Client HTTP vers le nouveau backend NestJS (module Réparations) — coexiste avec
// supabaseClient.js, toujours utilisé par la messagerie/présence/calendrier.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({ baseURL: API_URL });

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('qr_api_token');
  // Un en-tête déjà fourni (ex. session Supabase envoyée à /auth/session) est conservé.
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Jeton API expiré (24 h) ou invalide alors que la session Supabase est encore ouverte :
// sans cela, l'app paraît connectée mais les réparations et le temps réel ne marchent plus.
// On déconnecte proprement pour forcer une nouvelle connexion (sauf sur /auth/session,
// dont les erreurs sont gérées par la page de connexion).
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/session')) {
      setApiToken(null);
      disconnectSocket();
      await supabase.auth.signOut();
    }
    return Promise.reject(error);
  }
);

export function setApiToken(token) {
  if (token) localStorage.setItem('qr_api_token', token);
  else localStorage.removeItem('qr_api_token');
}
