# Migration vers le backend FastAPI

## Contexte

QuickRepair passe d'une architecture 100% Supabase (le frontend React parle directement à Supabase pour l'auth, les données et le temps réel) à une architecture avec un vrai backend FastAPI ([backend/](backend)) qui possède sa propre base Postgres et sa propre authentification. Objectif : abandonner complètement Supabase à terme (base de données ET authentification).

État actuel du backend (au démarrage de cette migration) : scaffolding FastAPI avec health check (`/api/v1/health`), CORS, et un hub WebSocket/Redis pour le temps réel ([backend/app/core/realtime.py](backend/app/core/realtime.py)) — mais aucun modèle de données, aucune route métier, pas encore de Postgres dans [docker-compose.yml](docker-compose.yml).

## Phases

Chaque phase doit rester testable indépendamment ; le frontend continue de fonctionner sur Supabase pendant que le backend se construit en parallèle, jusqu'à la bascule finale (Phase 7).

### Phase 1 — Couche données
- Ajouter un service Postgres à `docker-compose.yml`.
- Modéliser en SQLAlchemy les tables actuelles : `employes`, `clients`, `appareils`, `reparations`, `statuts`, `historique_statuts`, `factures`, `boutiques`.
- Mettre en place Alembic pour les migrations de schéma.

### Phase 2 — Authentification maison
- Hashing de mot de passe (passlib/bcrypt).
- Endpoints login / refresh token.
- Émission et vérification de JWT.
- Dépendance FastAPI pour protéger les routes par rôle (équivalent de `ProtectedRoute.jsx` côté backend).

### Phase 3 — Endpoints de lecture
- Routes GET pour chaque ressource, en remplacement des `supabase.from(...).select(...)` actuels dans les 4 dashboards.

### Phase 4 — Endpoints d'écriture + logique métier
- Création de ticket, changement de statut, facturation, gestion boutiques/équipe — en remplacement des `insert`/`update`/`delete` Supabase.

### Phase 5 — Temps réel
- Brancher le hub WebSocket déjà scaffoldé sur les événements réels (nouveau ticket assigné, changement de statut).
- Remplace le channel Supabase Realtime utilisé dans [TechDashboard.jsx](src/pages/technicien/TechDashboard.jsx).

### Phase 6 — Rebranchement du frontend
- Remplacer [src/supabaseClient.js](src/supabaseClient.js) et tous les appels `supabase.*` par des appels à la nouvelle API (axios/fetch).
- Réécrire [src/context/AuthContext.jsx](src/context/AuthContext.jsx) pour du JWT maison au lieu de Supabase Auth.

### Phase 7 — Migration des données + bascule
- Il y a déjà de vraies données dans le projet Supabase actuel (clients, réparations, factures...).
- Écrire un script de migration Postgres Supabase → Postgres du backend.
- Couper l'accès Supabase une fois la bascule validée.

## Suivi
- [ ] Phase 1 — Couche données
- [ ] Phase 2 — Authentification maison
- [ ] Phase 3 — Endpoints de lecture
- [ ] Phase 4 — Endpoints d'écriture + logique métier
- [ ] Phase 5 — Temps réel
- [ ] Phase 6 — Rebranchement du frontend
- [ ] Phase 7 — Migration des données + bascule
