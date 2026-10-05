import { io } from 'socket.io-client';

// Remplace tech-tasks-channel (Supabase Realtime) pour la notification "nouvelle
// réparation assignée" — un seul socket, authentifié par le même JWT que apiClient.
const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') : 'http://localhost:3000';

let socket = null;

export function getSocket() {
  const token = localStorage.getItem('qr_api_token');
  if (!token) return null;

  if (!socket) {
    socket = io(SOCKET_URL, { auth: { token }, autoConnect: false });
  }
  if (socket.auth.token !== token) {
    socket.auth = { token };
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
