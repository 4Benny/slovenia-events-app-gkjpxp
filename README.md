# improved_party_app

Monorepo:

- `frontend/` — Expo (React Native + web) application
- `backend/` — Fastify + Drizzle server

## Local dev

- Frontend: `npm run dev:frontend`
- Backend: `npm run dev:backend`

## Vercel

This repo is set up so Vercel builds the web app from `frontend/` only.
- Default build uses `vercel.json` (installs/builds only `frontend`).
- Alternatively, set the Vercel Project **Root Directory** to `frontend`.
