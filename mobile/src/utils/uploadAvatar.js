// Depuis expo-file-system v18 (SDK 54+), `readAsStringAsync` a été déplacé sous le
// sous-module `/legacy` — l'import par défaut lève volontairement une erreur si on
// l'utilise directement (nouvelle API basée sur les classes File/Directory).
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabaseClient';

// Port de ProfileModal.jsx (web) : même bucket `avatars`, même convention de chemin
// (dossier = auth uid, pour matcher les policies Storage déjà en place). Sur RN, on lit
// le fichier en base64 puis on le convertit en ArrayBuffer (upload direct d'un blob n'est
// pas fiable partout sur React Native) — c'est le pattern documenté par Supabase pour Expo.
export async function uploadAvatar({ localUri, authUid, idEmploye }) {
  const ext = localUri.split('.').pop().split('?')[0] || 'jpg';
  const path = `${authUid}/photo.${ext}`;
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, decode(base64), { contentType, upsert: true });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

  const { error: dbError } = await supabase.from('employes').update({ avatar_url: avatarUrl }).eq('id_employe', idEmploye);
  if (dbError) throw dbError;

  return avatarUrl;
}
