import { createClient } from '@supabase/supabase-js'

// Remplacez ces valeurs par celles de votre projet Supabase (Project Settings > API)
const supabaseUrl = 'https://ueeytlrvxuobeszglkfk.supabase.co'
const supabaseAnonKey = 'sb_publishable_mFJvqz9AoB-uZATp4NMjaA_JQSXg4R3'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)