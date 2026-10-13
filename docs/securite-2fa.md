# Sécurité — Double authentification (2FA) obligatoire

> Mise en place sur le **web** le 13/10/2026. Le mobile suivra (voir §5).

## 1. Principe

Chaque employé se connecte avec son **mot de passe** puis un **code à 6 chiffres** (TOTP, RFC 6238) généré par une application d'authentification (Google Authenticator, Microsoft Authenticator, Authy…). Le 2FA est **obligatoire pour tous les rôles**.

Mécanisme : Supabase Auth (MFA TOTP). Niveaux d'assurance de la session :

| Niveau | Signification |
|---|---|
| `aal1` | mot de passe vérifié |
| `aal2` | mot de passe + code vérifiés |

## 2. Parcours web

1. Saisie de l'e-mail et du mot de passe (`supabase.auth.signInWithPassword`) : la session est `aal1`.
2. **Première connexion** : activation obligatoire. Un QR code est affiché (`mfa.enroll`), l'employé le scanne et saisit le premier code (`mfa.challengeAndVerify`).
   **Connexions suivantes** : saisie du code.
3. La session passe en `aal2`. Le front l'échange contre le jeton de l'API : `POST /api/auth/session` avec `Authorization: Bearer <jeton Supabase>`.
4. Redirection vers le tableau de bord du rôle.

Garde-fous côté front :
- `AuthContext` : une session `aal1` n'a ni rôle ni données employé ;
- `ProtectedRoute` : sans `aal2`, retour à `/login`, qui reprend directement à l'étape du code (page rechargée, onglet rouvert…) ;
- un facteur non vérifié laissé par une activation interrompue est supprimé avant d'en créer un nouveau.

## 3. Côté API

- `POST /auth/login` (mot de passe seul) est **supprimée** : elle permettait d'obtenir un jeton sans code.
- `POST /auth/session` :
  1. valide le jeton auprès de Supabase Auth (`GET /auth/v1/user` : signature, expiration, déconnexion) ;
  2. lit le niveau `aal` dans le jeton validé : **403 « Double authentification requise »** si ce n'est pas `aal2` ;
  3. retrouve l'employé par `id_auth` (jamais par e-mail) : 403 si le compte n'est pas un employé ;
  4. délivre le jeton API (JWT, 24 h).
- L'API ne voit plus jamais le mot de passe (dépendance `bcryptjs` supprimée).
- Limitation de débit : 5 tentatives par minute et par IP, puis blocage 5 minutes.

Tests : `server/src/auth/auth.service.spec.ts`, `server/src/auth/supabase-auth.client.spec.ts`, `server/test/api.e2e-spec.ts` (sans jeton → 401, session invalide → 401, `aal1` → 403, non employé → 403, `aal2` → 201, `/auth/login` → 404) et `server/test/security.e2e-spec.ts` (anti force brute).

## 4. Téléphone perdu ou changé

Pour l'instant, la réinitialisation se fait par l'administrateur dans le **SQL Editor** de Supabase : elle supprime le facteur de l'employé, qui devra réactiver le 2FA (nouveau QR code) à sa prochaine connexion.

```sql
delete from auth.mfa_factors
where user_id = (select id_auth from public.employes where email = 'employe@exemple.fr');
```

Évolution prévue : un bouton « Réinitialiser la double authentification » dans l'espace admin, via une Edge Function (clé `service_role` côté serveur uniquement).

## 5. Limites actuelles et suite

- **Mobile** : l'appli Expo n'a pas encore l'écran de code. Elle reste en `aal1` et accède directement à Supabase. Le RLS ne peut donc pas encore **exiger** `aal2` sans la bloquer.
- Quand le mobile sera prêt : ajouter `(select auth.jwt()->>'aal') = 'aal2'` aux règles RLS, pour que le 2FA protège aussi les accès directs à la base, et pas seulement l'interface web et l'API.
- Fermer les inscriptions publiques Supabase (aujourd'hui ouvertes et sans confirmation d'e-mail).

## 6. Vérification préalable

Supabase → Authentication → Multi-Factor : **TOTP** doit être activé (« Enabled »), c'est le réglage par défaut.
