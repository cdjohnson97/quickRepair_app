// Edge Function : réinitialise le mot de passe d'un technicien à la demande de son manager.
// La clé service_role reste ici, côté serveur (auto-injectée par Supabase), jamais dans le frontend.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Authentification requise.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { id_employe } = await req.json();
    if (!id_employe) {
      return new Response(JSON.stringify({ error: 'id_employe manquant.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    // 1. Identifie l'appelant à partir de son JWT et vérifie qu'il est bien Responsable.
    const { data: callerAuth, error: callerAuthError } = await admin.auth.getUser(jwt);
    if (callerAuthError || !callerAuth?.user) {
      console.error('Étape 1 (getUser) échouée :', callerAuthError?.message, '| jwt reçu, longueur =', jwt.length);
      return new Response(JSON.stringify({ error: 'Session invalide.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: caller, error: callerError } = await admin
      .from('employes')
      .select('id_employe, role, id_boutique')
      .eq('id_auth', callerAuth.user.id)
      .maybeSingle();

    if (callerError || !caller || caller.role !== 'Responsable') {
      console.error(
        'Étape 2 (lookup employes appelant) échouée :',
        callerError?.message,
        '| auth.uid =', callerAuth.user.id,
        '| ligne trouvée =', JSON.stringify(caller)
      );
      return new Response(JSON.stringify({ error: "Action réservée aux responsables." }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Vérifie que la cible est bien un technicien de la même boutique.
    const { data: target, error: targetError } = await admin
      .from('employes')
      .select('id_employe, id_auth, role, id_boutique')
      .eq('id_employe', id_employe)
      .maybeSingle();

    if (targetError || !target || target.role !== 'Technicien' || target.id_boutique !== caller.id_boutique) {
      console.error(
        'Étape 3 (lookup employe cible) échouée :',
        targetError?.message,
        '| cible trouvée =', JSON.stringify(target),
        '| boutique appelant =', caller.id_boutique
      );
      return new Response(JSON.stringify({ error: 'Employé introuvable ou non autorisé.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Génère un mot de passe temporaire et l'applique via l'API admin.
    const tempPassword = generateTempPassword();
    const { error: updateError } = await admin.auth.admin.updateUserById(target.id_auth, {
      password: tempPassword,
      user_metadata: { must_change_password: true },
    });

    if (updateError) {
      console.error('Étape 4 (updateUserById) échouée :', updateError.message);
      throw updateError;
    }

    return new Response(JSON.stringify({ password: tempPassword }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message ?? 'Erreur inattendue.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
