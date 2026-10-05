import { createClient } from '@supabase/supabase-js'

// Remplacez ces valeurs par celles de votre projet Supabase (Project Settings > API)
const supabaseUrl = 'https://ueeytlrvxuobeszglkfk.supabase.co'
const supabaseAnonKey = 'sb_publishable_mFJvqz9AoB-uZATp4NMjaA_JQSXg4R3'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client isolé, sans persistance de session : utilisé pour créer des comptes (ex: nouvel employé
// depuis l'espace admin) sans remplacer la session de l'utilisateur actuellement connecté.
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
})