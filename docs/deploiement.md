# FiXeo — Procédure de déploiement

## 1. Architecture de production

| Élément | Hébergement | URL |
|---|---|---|
| Front React (site statique) | Render — Static Site `fixeo-web` | https://fixeo-web.onrender.com |
| API NestJS (conteneur Docker) | Render — Web Service `fixeo-api` (Francfort, plan gratuit) | https://fixeo-api.onrender.com/api |
| Base PostgreSQL, Auth, Realtime, Storage | Supabase (projet `ueeytlrvxuobeszglkfk`, eu-central-1) | — |
| Application mobile | Expo (hors Render) | — |

La configuration Render est décrite dans le fichier **`render.yaml`** (Blueprint, « infrastructure as code ») à la racine du dépôt.

## 2. Chaîne CI/CD

```
git push sur main
   │
   ▼
GitHub Actions (.github/workflows/ci.yml)
   ├─ API : npm ci → prisma generate → lint → tests unitaires → tests d'intégration → build
   ├─ Front : npm ci → build
   └─ Images Docker construites et publiées sur GHCR (ghcr.io/cdjohnson97/fixeo-api, fixeo-web)
   │
   ▼  (uniquement si tous les contrôles sont verts : autoDeployTrigger: checksPass)
Render
   ├─ fixeo-api : reconstruit server/Dockerfile, contrôle de santé sur /api, puis bascule
   └─ fixeo-web : npm ci && npm run build, publie dist/
```

- Un échec de la CI bloque le déploiement : le code cassé n'atteint jamais la production.
- `buildFilter` : une modification du front ne redéploie pas l'API, et inversement.
- Pendant le déploiement de l'API, Render garde l'ancienne version en ligne tant que la nouvelle n'a pas passé son contrôle de santé.

## 3. Premier déploiement (une seule fois)

1. Créer un compte sur https://render.com avec le compte GitHub `cdjohnson97`.
2. **New → Blueprint**, choisir le dépôt, branche `main`. Render lit `render.yaml` et propose les deux services.
3. Renseigner les variables marquées `sync: false` :
   - `DATABASE_URL` : la même valeur que dans `server/.env` (Supabase → Connect → Session pooler).
   - `VITE_EMAILJS_*` : facultatif (valeurs EmailJS), sinon laisser vide.
4. Valider : Render crée les deux services et lance le premier déploiement.
5. Vérifier les URL attribuées. Si elles diffèrent de `fixeo-api.onrender.com` / `fixeo-web.onrender.com`, mettre à jour :
   - `CORS_ORIGIN` de `fixeo-api` (URL du front) ;
   - `VITE_API_URL` de `fixeo-web` (URL de l'API + `/api`), puis relancer un déploiement du front ;
   - et les mêmes valeurs dans `render.yaml`.
6. Supabase → Authentication → URL Configuration : ajouter l'URL du front si des e-mails Supabase (réinitialisation de mot de passe…) doivent y renvoyer.

## 4. Variables d'environnement

| Service | Variable | Valeur | Secret |
|---|---|---|---|
| fixeo-api | `DATABASE_URL` | Chaîne de connexion Supabase (pooler) | Oui |
| fixeo-api | `JWT_SECRET` | Générée aléatoirement par Render | Oui |
| fixeo-api | `JWT_EXPIRES_IN` | `24h` | Non |
| fixeo-api | `CORS_ORIGIN` | URL du front | Non |
| fixeo-api | `PORT` | Fournie automatiquement par Render | Non |
| fixeo-web | `VITE_API_URL` | URL de l'API + `/api` (intégrée au build) | Non (publique) |
| fixeo-web | `VITE_EMAILJS_*` | Identifiants publics EmailJS | Non (publics) |
| fixeo-web | `NODE_VERSION` | `24` | Non |

Les secrets ne sont jamais dans le dépôt ni dans les images Docker : ils sont saisis dans Render (Environment). Le `JWT_SECRET` de production est différent de celui de développement.

## 5. Vérifications après déploiement (recette)

```bash
API=https://fixeo-api.onrender.com/api
curl -i $API                                   # 200 "Hello World!"
curl -i $API/reparations                       # 401 (route protégée)
curl -i $API/reparations/track/QR-00000        # 404 (la base répond)
curl -i -X POST $API/auth/login -H "Content-Type: application/json" \
     -d '{"email":"x@fixeo.fr","password":"xxxxxx"}'   # 401 Identifiants incorrects
```
Puis dans le navigateur, sur https://fixeo-web.onrender.com : connexion avec un compte réel, création d'un ticket (Responsable), réception de la notification (Technicien), suivi client avec le numéro obtenu.

## 6. Retour arrière (rollback)

Render → service concerné → **Events** → choisir le dernier déploiement fonctionnel → **Rollback**. Corriger ensuite le code : le prochain push vert redéploiera normalement.

## 7. Limites du plan gratuit

- L'API s'endort après 15 minutes sans requête ; le premier appel suivant prend environ une minute (démarrage à froid). Penser à « réveiller » l'API avant une démonstration.
- 750 heures d'exécution par mois pour l'ensemble des services gratuits.
- Pour un usage réel : plan payant (pas de mise en veille) ou VPS avec `docker compose`.

## 8. Environnements

| Environnement | Où | Lancement |
|---|---|---|
| Développement | Poste local | `npm run dev` (front), `npm run start:dev` (API) — voir `INSTALLATION.md` |
| Test | GitHub Actions + local | `npm test`, `npm run test:e2e` (base simulée, aucune donnée réelle) ; `docker compose up` pour tester les images |
| Production | Render + Supabase | Déploiement automatique après CI verte |
