import axios from 'axios';

// Client HTTP vers le nouveau backend NestJS (module Réparations) — coexiste avec
// supabaseClient.js, toujours utilisé par la messagerie/présence/calendrier.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({ baseURL: API_URL });

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('qr_api_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function setApiToken(token) {
  if (token) localStorage.setItem('qr_api_token', token);
  else localStorage.removeItem('qr_api_token');
}
