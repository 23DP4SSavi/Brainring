# Brainring

Vue + Vite frontend, Node.js + Express API, SQLite SQL database.
Requires Node.js 24.14 or newer. Run commands from the repository root.

## Backend (terminal 1)

```powershell
cd backend
npm.cmd install
npm.cmd run dev
```

API: http://localhost:3000/api/health
Questions: http://localhost:3000/api/questions (initially an empty list).
SQLite creates `backend/data/brainring.sqlite` on first start.
Schema: `backend/src/schema.sql`. Local database files are ignored by Git.
Node 24 may print an experimental warning for its built-in SQLite module.

## Frontend (terminal 2)

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open the URL shown by Vite. Edit `frontend/src/App.vue`.
During development, Vite forwards `/api` requests to the backend on port 3000.

## Build frontend

```powershell
cd frontend
npm.cmd run build
```

Output: `frontend/dist`. For deployment, configure hosting to forward `/api`
to the backend; the Vite development proxy is only for development.