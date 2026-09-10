# QuickRepair

Application de suivi de réparations : front React/Vite et API FastAPI en cours de migration.

## Backend FastAPI local

- `backend/` contient l'API, son environnement Python et l'infrastructure temps réel Redis.
- Créez la configuration locale avec `Copy-Item backend/.env.example backend/.env`.
- Activez l'environnement : `backend\\.venv\\Scripts\\Activate.ps1`.
- Démarrez Redis : `docker compose up -d redis`.
- Lancez l'API : `backend\\.venv\\Scripts\\uvicorn.exe app.main:app --app-dir backend --reload`.

L'état de l'API sera disponible sur `http://localhost:8000/api/v1/health` et sa documentation sur `http://localhost:8000/docs`.

Le front continue volontairement d'utiliser Supabase durant cette première étape. Les accès sensibles seront déplacés progressivement vers FastAPI, puis les WebSockets sécurisés seront connectés au front.

## Interface Vite existante

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
