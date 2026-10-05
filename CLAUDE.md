# QuickRepair — instructions pour Claude

L'utilisateur parle français : répondre en français.

Installation, lancement, secrets et organisation du projet : voir @INSTALLATION.md (à suivre en priorité si l'utilisateur arrive sur un nouveau PC).

Objectif en cours : préparer le titre professionnel CDA (Concepteur Développeur d'Applications) avec ce projet. Plan d'action et avancement : voir @TODO.md (le mettre à jour en cochant les tâches terminées). Dossier de conception : `docs/conception.md`.

## Périmètre
- Projets actifs : front React (racine, `src/`), serveur NestJS (`server/`), mobile Expo (`mobile/`, voir aussi `mobile/CLAUDE.md`).
- `backend/` (FastAPI) et `MIGRATION_BACKEND.md` : ancienne piste, ne pas y toucher sauf demande explicite.

## Règles importantes
- **Secrets** : `server/.env` et `server/.env.keys` ne doivent jamais être commités ni affichés (pas de `cat`, `diff` ou `echo` de leur contenu). Le dépôt GitHub est public. Après modification de `server/.env` : `cd server && npm run env:encrypt` puis commiter `server/.env.encrypted`.
- **Base de données** : `server/prisma/schema.prisma` a été généré par introspection de la base Supabase de production (il contient aussi les schémas internes `auth`, etc.). Ne **jamais** lancer `prisma migrate`, `prisma db push` ou `prisma migrate reset`. Utiliser seulement `prisma generate` (et `prisma db pull` si le schéma de la base change).
- **Tests sans effet de bord** : les tests (`npm test` dans `server/`) utilisent un mock Prisma. Pour tester l'API en marche, ne pas créer/modifier de données réelles sans accord.
- **Windows** : les scripts npm passent par `cmd.exe` (pas de `cp`, `rm` dans `package.json` — utiliser Node). Arrêter un serveur lancé en tâche de fond peut laisser le processus `node` actif : vérifier les ports 3000 / 5173.

## Vérifications avant de dire « ça marche »
- Serveur : `cd server && npm run build && npm test`.
- Front : `npm run build` (le lint `npm run lint` a des erreurs préexistantes non bloquantes : variables inutilisées, dépendances de `useEffect`).
