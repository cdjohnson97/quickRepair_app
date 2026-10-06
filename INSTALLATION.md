# FiXeo — Installer le projet sur un nouveau PC

Ce guide permet de remettre tout le projet en route sur une machine neuve, sans rien connaître d'autre.

## 0. Ce qu'il faut avoir avant de commencer

| Quoi | Où le trouver | Obligatoire ? |
|---|---|---|
| **La clé `server/.env.keys`** | Ton gestionnaire de mots de passe / ta sauvegarde (elle n'est **pas** sur GitHub) | Oui, pour le serveur NestJS |
| Accès au compte GitHub `cdjohnson97` | — | Oui |
| Accès au projet Supabase `ueeytlrvxuobeszglkfk` | https://supabase.com/dashboard | Pour gérer la base |
| Compte Expo `chancedarlon` | https://expo.dev | Seulement pour publier l'appli mobile |
| Compte EmailJS | https://www.emailjs.com | Facultatif (e-mails de confirmation client) |

La clé `.env.keys` ressemble à ceci (une seule ligne) :
```
DOTENV_PRIVATE_KEY_ENCRYPTED="…une longue suite de caractères…"
```
**Sans elle, impossible de retrouver le mot de passe de la base ni le secret JWT.** Si elle est perdue : voir la section 7.

## 1. Logiciels à installer

- **Node.js 24** (LTS) — https://nodejs.org (le projet tourne avec Node 24.14 / npm 11.9)
- **Git** — https://git-scm.com
- **VS Code** — https://code.visualstudio.com
- **Claude Code** (facultatif) — extension VS Code ou `npm install -g @anthropic-ai/claude-code`
- **Expo Go** sur le téléphone (Play Store / App Store) — doit être compatible **Expo SDK 57**

Vérifier : `node -v` et `git --version`.

## 2. Récupérer le code

```bash
cd C:\Users\<toi>\Documents\code
git clone https://github.com/cdjohnson97/quickRepair_app.git FiXeo
cd FiXeo
```

## 3. Installer les dépendances (3 projets)

```bash
npm install                  # front web (racine)
cd server && npm install     # serveur NestJS
cd ../mobile && npm install  # appli mobile
cd ..
```

## 4. Recréer les fichiers secrets

### Serveur NestJS (obligatoire)
1. Créer le fichier `server/.env.keys` et y coller la clé (voir section 0).
2. Puis :
```bash
cd server
npm run env:decrypt      # recrée server/.env depuis server/.env.encrypted
npx prisma generate      # prépare le client d'accès à la base
```
`server/.env` contient : `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `PORT`.

### Front web (facultatif)
Uniquement pour l'envoi d'e-mails EmailJS : copier `.env.example` en `.env` à la racine et remplir les `VITE_EMAILJS_*` (valeurs sur emailjs.com). Sans ce fichier, tout fonctionne sauf ces e-mails.

### Mobile
Rien à faire : l'URL Supabase et la clé publique (anon) sont dans `mobile/src/supabaseClient.js`.

## 5. Lancer les projets

Un terminal par projet. Arrêter avec **Ctrl + C**.

| Projet | Dossier | Commande | Adresse |
|---|---|---|---|
| Serveur NestJS | `server/` | `npm run start:dev` | http://localhost:3000/api |
| Front React | racine | `npm run dev` | http://localhost:5173 |
| Mobile Expo | `mobile/` | `npm start` | QR code à scanner avec Expo Go |

- Lancer **le serveur avant le front** : le front l'appelle (connexion, réparations, boutiques, suivi client).
- Le **mobile n'a pas besoin du serveur** : il parle directement à Supabase.
- Mobile sur un autre réseau Wi-Fi que le PC : `npx expo start --tunnel`.
- Dans le terminal Expo : `w` = ouvrir dans le navigateur, `a` = émulateur Android.

### Vérifier que tout marche
```bash
cd server
npm run build   # doit compiler sans erreur
npm test        # ~112 tests doivent passer
```
Puis ouvrir http://localhost:3000/api → doit afficher `Hello World!`.

## 6. Gérer les secrets au quotidien

- Modifier une variable : éditer `server/.env`, puis `cd server && npm run env:encrypt`, puis commiter `server/.env.encrypted`.
- **Ne jamais commiter** `server/.env` ni `server/.env.keys` (déjà exclus par `.gitignore`).
- Le dépôt GitHub est **public** : aucun mot de passe en clair dans le code.

## 7. Si la clé `.env.keys` est perdue

Le fichier chiffré devient inutilisable. On recrée tout :
1. Copier `server/.env.example` en `server/.env`.
2. `DATABASE_URL` : Supabase → projet → bouton **Connect** → **Session pooler**. Si le mot de passe de la base est oublié : **Project Settings → Database → Reset password**.
3. `JWT_SECRET` : en générer un nouveau avec
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   (les utilisateurs devront se reconnecter).
4. Supprimer l'ancien `server/.env.encrypted`, puis `npm run env:encrypt` → une nouvelle clé `.env.keys` est créée. **La sauvegarder immédiatement.**
5. Commiter le nouveau `server/.env.encrypted`.

## 8. Organisation du projet

```
FiXeo/
├── src/            Front web React 19 + Vite 7 + Tailwind 3
├── server/         API NestJS 12 + Prisma 6 (base Postgres Supabase) + Socket.io
├── mobile/         Appli Expo SDK 57 / React Native 0.86 + NativeWind
├── supabase/       Edge function reset-employee-password
├── backend/        API FastAPI — ancienne piste, NON utilisée actuellement
├── INSTALLATION.md Ce guide
└── CLAUDE.md       Instructions pour Claude Code
```

- **Base de données** : Postgres hébergé sur Supabase (projet `ueeytlrvxuobeszglkfk`), partagée par le front, le mobile et le serveur.
- **Front web** : parle au serveur NestJS (`src/apiClient.js`) pour la connexion, les réparations, les boutiques et le suivi client ; et directement à Supabase (`src/supabaseClient.js`) pour la messagerie, la présence et le calendrier.
- **Rôles** : admin, manager, technicien, + page publique de suivi client.
- **Dépôt GitHub** : https://github.com/cdjohnson97/quickRepair_app (branche `main`).
