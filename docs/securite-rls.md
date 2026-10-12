# Sécurité — Activation du Row Level Security (RLS) sur Supabase

> Faille découverte le 11/10/2026, correction préparée et testée le 12/10/2026.
> Script : `supabase/migrations/20261012120000_activer_rls.sql` · annulation : `supabase/rollback/20261012120000_activer_rls.down.sql`.

## 1. Constat

Le front web et l'appli mobile interrogent directement la base Supabase avec la **clé publique** (`anon`), présente dans le code source (dépôt public). La sécurité de ces accès repose entièrement sur le RLS de PostgreSQL.

État relevé (requêtes de catalogue, lecture seule) :

| Point | Constat |
|---|---|
| RLS | désactivé sur 13 tables sur 14 ; `factures` l'avait, avec une règle « tout le monde peut tout faire » |
| Droits `anon` | `SELECT, INSERT, UPDATE, DELETE, TRUNCATE…` sur toutes les tables |
| Données exposées sans connexion | employés, clients (nom, e-mail, téléphone), réparations, factures, messages internes |
| `employes.mot_de_passe_hash` | 4 lignes contenant des mots de passe **en clair** (anciens comptes de test) |
| Inscriptions Supabase Auth | ouvertes : n'importe qui peut créer un compte « connecté » |
| Liaison compte ↔ employé | par e-mail ; 8 employés sur 15 sans `id_auth`, 1 `id_auth` vers un compte supprimé |

Risques (OWASP Top 10 2021) : **A01 Broken Access Control** (lecture et modification de toutes les données), **A02 Cryptographic Failures** (mots de passe en clair), **A07 Identification and Authentication Failures** (un compte créé avec l'e-mail d'un employé héritait de ses droits). Manquement au **RGPD** (art. 32, sécurité du traitement) pour les données des clients.

## 2. Correction

### Principes
- **Moindre privilège** : `anon` n'a plus aucun accès aux tables. Les pages publiques (accueil, suivi client) passent par l'API NestJS, qui ne renvoie que des champs choisis.
- Un compte connecté n'a des droits **que s'il est rattaché à un employé** (`employes.id_auth = auth.uid()`), jamais par l'e-mail.
- Droits selon le **rôle** (Administrateur, Responsable, Technicien) et la **boutique**.
- L'API NestJS se connecte avec le rôle `postgres` (`BYPASSRLS`) : elle n'est pas affectée et applique ses propres contrôles (guards JWT + rôles).

### Mise en œuvre
1. **Données** : rattachement des employés à leur compte par e-mail (`id_auth`), suppression des mots de passe en clair, boutique renseignée sur les réparations qui n'en avaient pas.
2. **Fonctions utilitaires** dans un schéma `private` non exposé par l'API REST, en `SECURITY DEFINER` avec `search_path` vide : `employe_courant()`, `role_courant()`, `boutique_courante()`, `meme_boutique()`, `peut_voir_reparation()`…
3. **Triggers** :
   - un employé ne peut pas changer son propre rôle, sa boutique ou son compte (seul l'administrateur le peut) ;
   - une réparation créée sans boutique reçoit celle du responsable connecté ;
   - l'historisation des statuts passe en `SECURITY DEFINER` pour rester automatique.
4. **Droits** : `REVOKE ALL` pour `anon` ; `TRUNCATE` (qui ignore le RLS) retiré à `authenticated` ; sur `messages`, seules les colonnes `lu` et `reaction` sont modifiables.
5. **RLS activé sur les 14 tables**, avec des règles par opération (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
6. **API** : `/auth/login` retrouve l'employé par `id_auth` et non plus par e-mail.

### Matrice des droits

| Table | Administrateur | Responsable | Technicien |
|---|---|---|---|
| employes | tout | lecture ; sa propre ligne (hors rôle / boutique) | idem responsable |
| boutiques | tout | lecture | lecture |
| reparations | tout | sa boutique (lecture, création, modification) | ses réparations assignées |
| historique_statuts, factures | tout | réparations de sa boutique (+ création de facture) | ses réparations |
| clients, appareils | tout | tout (recherche d'un client existant) | ceux de ses réparations |
| messages | ses conversations | ses conversations | ses conversations |
| calendrier_evenements | tout | son équipe | lecture : sa boutique ; écriture : les siens |
| statuts, types_reparation | lecture | lecture | lecture |
| pieces, fournisseurs, stock_boutique | API uniquement | API uniquement | API uniquement |

## 3. Tests

Test **à blanc** sur la base réelle : tout le script s'exécute dans une transaction, chaque profil est simulé (`set role authenticated` + `request.jwt.claims`), puis `ROLLBACK` (aucune modification conservée).

| Profil | Action | Attendu | Obtenu |
|---|---|---|---|
| Non connecté (anon) | lire n'importe quelle table | refusé | refusé (42501) sur les 11 tables testées |
| Compte connecté non employé | lire les tables | 0 ligne | 0 ligne partout |
| | envoyer un message | refusé | refusé |
| Technicien | lire les réparations | les siennes (12 / 23) | 12 |
| | modifier son `last_seen` | autorisé | 1 ligne |
| | se donner le rôle Administrateur | refusé | refusé (trigger) |
| | modifier / supprimer un autre employé | aucun effet | 0 ligne |
| | changer le statut de **sa** réparation | autorisé + historique créé | 1 ligne, historique 0 → 1, commentaire ajouté |
| | changer le statut de la réparation d'un autre | aucun effet | 0 ligne |
| | envoyer un message en usurpant l'expéditeur | refusé | refusé |
| | modifier le contenu d'un message | refusé | refusé (droit de colonne) |
| | `TRUNCATE messages` | refusé | refusé |
| | créer un client | refusé | refusé |
| | événement pour lui / pour un autre | autorisé / refusé | autorisé / refusé |
| Responsable (boutique 1) | lire les réparations | sa boutique (16 / 23) | 16 |
| | créer un ticket sans `id_boutique` (ancien mobile) | autorisé, boutique 1 | autorisé, boutique 1 |
| | modifier une réparation d'une autre boutique | aucun effet | 0 ligne |
| | créer un employé / une boutique | refusé | refusé |
| | événement pour son technicien / autre boutique | autorisé / refusé | autorisé / refusé |
| Administrateur | tout lire, promouvoir, créer boutique et employé | autorisé | autorisé |

Côté API : 125 tests unitaires et 46 tests d'intégration verts, dont la recherche de l'employé par `id_auth`.

## 4. Procédure d'application

1. Exécuter `supabase/migrations/20261012120000_activer_rls.sql` (SQL Editor de Supabase, ou client PostgreSQL). Le script est transactionnel : en cas d'erreur, rien n'est appliqué.
2. Déployer l'API (fusion de la PR) **après** l'étape 1 : la connexion par `id_auth` suppose les employés rattachés.
3. Recette manuelle : connexion web et mobile avec un compte de chaque rôle, messagerie (envoi, lu, temps réel), calendrier, création de ticket mobile, facture mobile, photo de profil.
4. En cas de blocage : `supabase/rollback/20261012120000_activer_rls.down.sql`.

## 5. Suites
- Fermer les inscriptions publiques Supabase (Authentication → Sign In / Providers → « Allow new users to sign up ») : les comptes sont créés par l'administrateur. À faire après avoir déplacé la création de compte côté serveur (Edge Function), car le front utilise aujourd'hui `signUp`.
- Double authentification (TOTP) pour les administrateurs et responsables, exigée par les règles RLS (`aal2`).
- Supprimer la colonne `employes.mot_de_passe_hash`, désormais vide.
