import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Même projet Supabase que l'app web (src/supabaseClient.js) : les deux clients
// pointent sur la même base, donc toute mise à jour est visible des deux côtés.
const supabaseUrl = 'https://ueeytlrvxuobeszglkfk.supabase.co';
const supabaseAnonKey = 'sb_publishable_mFJvqz9AoB-uZATp4NMjaA_JQSXg4R3';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Client isolé, sans persistance de session : utilisé pour créer des comptes employés
// (espace Admin) sans remplacer la session de l'admin actuellement connecté.
// Port de la même logique que src/supabaseClient.js (web).
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
