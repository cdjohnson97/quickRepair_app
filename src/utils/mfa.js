import { supabase } from '../supabaseClient';
import { apiClient, setApiToken } from '../apiClient';

// Double authentification (TOTP : code à 6 chiffres d'une application comme Google
// Authenticator, Microsoft Authenticator ou Authy), obligatoire pour tous les employés.
// Niveaux Supabase : aal1 = mot de passe seul, aal2 = mot de passe + code vérifié.

export async function getMfaStatus() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return {
    verified: data.currentLevel === 'aal2', // code déjà saisi pour cette session
    enrolled: data.nextLevel === 'aal2' // 2FA déjà activé sur le compte
  };
}

// Première activation : renvoie le QR code à scanner (et la clé, pour une saisie manuelle).
export async function startEnrollment() {
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  // Activation interrompue lors d'une connexion précédente : le facteur non vérifié bloquerait
  // la création d'un nouveau, on le supprime.
  for (const factor of factors.all.filter((f) => f.status === 'unverified')) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'FiXeo',
    issuer: 'FiXeo'
  });
  if (enrollError) throw enrollError;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function getVerifiedFactorId() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp[0]?.id ?? null;
}

// Vérifie un code (activation ou connexion) : la session Supabase passe en aal2.
export async function verifyCode(factorId, code) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
}

// Échange la session Supabase (aal2) contre le jeton de l'API NestJS, qui refuse toute
// session sans double authentification.
export async function openApiSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Session expirée.');
  setApiToken(null);
  const { data } = await apiClient.post('/auth/session', null, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  setApiToken(data.access_token);
}
