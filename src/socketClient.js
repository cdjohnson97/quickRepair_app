import { io } from 'socket.io-client';

// Remplace tech-tasks-channel (Supabase Realtime) pour la notification "nouvelle
// réparation assignée" — un seul socket, authentifié par le même JWT que apiClient.
const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') : 'http://localhost:3000';

let socket = null;

export function getSocket() {
  const token = localStorage.getItem('qr_api_token');
  if (!token) return null;

  // Le serveur place le socket dans la room de l'utilisateur à la connexion : si le jeton a
  // changé (autre compte dans le même onglet), il faut une nouvelle connexion, pas une mise à jour.
  if (socket && socket.auth.token !== token) disconnectSocket();

  if (!socket) {
    socket = io(SOCKET_URL, { auth: { token }, autoConnect: false });
    socket.on('connect_error', (err) => console.warn('Connexion temps réel impossible :', err.message));
    socket.on('disconnect', (reason) => {
      // "io server disconnect" : le serveur a refusé le jeton (expiré ou invalide).
      if (reason === 'io server disconnect') console.warn('Connexion temps réel refusée par le serveur (jeton expiré ?)');
    });
  }
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
