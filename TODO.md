# TODO — Préparation du titre CDA (RNCP37873)

Plan d'action issu de l'audit du projet face au référentiel CDA (TP-01281, millésime 04, 2023).
Cocher au fur et à mesure (`- [x]`). Ordre = priorité.

**Rappel de l'examen** (2 h 15) : présentation du projet 40 min (dossier projet de 40 à 60 pages + annexes ≤ 40 pages, diaporama) · entretien technique 45 min · questionnaire professionnel 30 min (documentation en anglais, réponses en anglais) · entretien final 20 min.
Le projet doit obligatoirement couvrir 8 des 11 compétences (marquées \* ci-dessous).

## État actuel par compétence

| Bloc | Compétence | État |
|---|---|---|
| 1 | Installer et configurer son environnement de travail | ✅ conteneurs Docker pour l'API et le front |
| 1 | Développer des interfaces utilisateur\* | 🟡 pas de tests front, pas de maquettes, RGPD/RGAA quasi absents |
| 1 | Développer des composants métier\* | ✅ NestJS, JWT, bcrypt, guards, validation, 112 tests unitaires |
| 1 | Contribuer à la gestion d'un projet informatique\* | ❌ aucune trace de planification |
| 2 | Analyser les besoins et maquetter une application\* | ❌ pas d'expression des besoins ni de maquettes |
| 2 | Définir l'architecture logicielle\* | 🟡 multicouche OK, mais le front contourne l'API ; éco-conception absente |
| 2 | Concevoir et mettre en place une BDD relationnelle\* | 🟡 MCD/MLD faits ; manque script SQL, base de test, confidentialité |
| 2 | Développer des composants d'accès aux données SQL **et NoSQL**\* | ❌ aucun NoSQL dans les projets actifs |
| 3 | Préparer et exécuter les plans de tests\* | 🟡 112 tests unitaires + 34 e2e ; pas de plan de tests écrit |
| 3 | Préparer et documenter le déploiement | 🟡 Docker + compose OK ; reste procédure et mise en ligne |
| 3 | Contribuer à la mise en production (DevOps) | 🟡 CI GitHub Actions OK (lint, tests, build, images GHCR) ; reste le déploiement continu |

## Actions

### 1. Sécurité de la base Supabase — URGENT
- [ ] Activer le Row Level Security (RLS) sur **toutes** les tables du schéma `public`.
- [ ] Écrire les policies par rôle (Administrateur, Responsable, Technicien) pour chaque table utilisée par le front et le mobile (`employes`, `messages`, `calendrier_evenements`, `reparations`, `clients`, `appareils`, `historique_statuts`, `statuts`, `boutiques`, `factures`, bucket `avatars`).
- [ ] Revoir les policies existantes de `factures`.
- [ ] Ne jamais exposer `mot_de_passe_hash` ni les données personnelles des clients côté client.
- [ ] Tester le web et le mobile après activation (sinon les écrans cassent).
- [ ] Documenter la faille et sa correction pour la section « veille sécurité » du dossier projet.

### 2. Composant NoSQL (compétence obligatoire)
- [ ] Ajouter un composant NoSQL dans le serveur NestJS : Redis (cache + adapter Socket.io) ou MongoDB (journal d'audit / notifications).
- [ ] Tests unitaires et de sécurité associés.

### 3. Intégration continue
- [x] GitHub Actions : lint + tests + build pour `server/` et le front (`.github/workflows/ci.yml`). Images Docker publiées sur GHCR depuis `main`.
- [ ] Ajouter le lint du front à la CI (après correction des 71 erreurs).
- [ ] Interpréter et documenter les rapports de CI (captures pour le dossier).

### 4. Conteneurisation et déploiement
- [x] `server/Dockerfile`, `Dockerfile` (front nginx) + `docker-compose.yml` (API + front), testés en local.
- [ ] Ajouter le service NoSQL au `docker-compose.yml` (voir action 2).
- [ ] Alléger l'image API (801 Mo actuellement).
- [x] Rédiger la procédure de déploiement : `docs/deploiement.md` (Render, CI/CD, variables, recette, rollback).
- [x] Blueprint Render `render.yaml` : API (Docker) + front (statique), déploiement seulement si la CI est verte.
- [ ] Créer le Blueprint sur render.com et faire la recette de production (voir `docs/deploiement.md` §3 et §5).
- [ ] Définir les environnements (dev / test / prod) et la procédure des tests d'intégration, système et d'acceptation.

### 5. Analyse des besoins et maquettes
- [ ] Rédiger l'expression des besoins (objectifs, limites, contraintes, livrables).
- [ ] Maquettes Figma des écrans principaux (web + mobile).
- [ ] Schéma d'enchaînement des maquettes.

### 6. Plan de tests
- [ ] Rédiger le plan de tests couvrant toutes les fonctionnalités.
- [ ] Jeu d'essai de la fonctionnalité la plus représentative (création de ticket) : entrées, résultats attendus, résultats obtenus, analyse des écarts.
- [ ] Tests front (Vitest + Testing Library) sur quelques composants.

### 7. Base de données
- [ ] Ajouter le script SQL de création (`pg_dump --schema-only` → `docs/sql/schema.sql`).
- [ ] Base de test + script de seed (jeu d'essai complet) + procédure de restauration.
- [ ] Ajouter les contraintes manquantes : `NOT NULL` sur les FK obligatoires, `UNIQUE` sur `factures.id_reparation` (voir `docs/conception.md` §3.4).

### 8. Diagrammes de séquence
- [ ] « Créer un ticket de réparation ».
- [ ] « Mettre à jour le statut d'une réparation ».
- [ ] Les ajouter à `docs/conception.md`.

### 9. Gestion de projet
- [ ] Rassembler les preuves existantes (Trello / Notion / planning…).
- [ ] À partir de maintenant : GitHub Projects (backlog), branches + pull requests, commits plus petits.

### 10. Renforcement de l'API
- [ ] `helmet` (en-têtes HTTP de sécurité).
- [ ] Limitation de débit sur `/auth/login` (`@nestjs/throttler`).
- [ ] Veille OWASP Top 10 documentée pour le dossier projet.

### Autres points relevés
- [ ] Éco-conception : découper le bundle front (1,8 Mo) en chargement par page (`import()` dynamique).
- [ ] RGPD : mentions légales, information des clients, durée de conservation des données.
- [ ] Accessibilité (RGAA) : libellés `aria`, contrastes, navigation au clavier.
- [ ] Corriger les erreurs de lint du front (71 erreurs, non bloquantes).

## Documents existants
- `docs/conception.md` : règles de gestion, MCD, MLD, dictionnaire de données, cas d'utilisation.
- `INSTALLATION.md` : installation sur un nouveau PC.
- `CLAUDE.md` : instructions pour Claude Code.
