---
name: Mesurado Vercel auth crash (empty JSON response)
description: Root cause and fix for "Unexpected end of JSON input" on login/signup in the Vercel-deployed Mesurado dashboard.
---

## Symptom
Production (Vercel, custom domain techliberia.online) showed "Failed to execute 'json' on 'Response': Unexpected end of JSON input" on the sign-in and sign-up screens. Same code ran fine in the Replit dev workflow.

## Root cause
`artifacts/api-server/src/app.ts`'s CORS origin-check called `callback(new Error(...))` for any origin not in its allow-list. That throws inside the `cors` middleware, which calls Express's `next(err)` — with no error-handling middleware registered, this could reach Vercel's serverless boundary as a broken/empty response instead of a normal HTTP error, which the frontend's unconditional `res.json()` then failed to parse.

Compounding factor: `MESURADO_DOMAIN` (used to build the CORS allow-list) is an env var that must be set **separately in Vercel's project settings** — it is not shared with Replit's env/secrets. If it's unset or stale there, the real production origin gets rejected.

## Fix applied
- CORS origin check now calls `callback(null, false)` (clean rejection, no throw) instead of passing an Error.
- Added a global 4-arg Express error-handling middleware at the end of `app.ts` that guarantees every response is valid JSON (`{ error: ... }`) even for errors that escape a route's own try/catch.
- `ALLOWED_ORIGINS` now parses `MESURADO_DOMAIN` as a comma-separated list and always includes `techliberia.online` as a hardcoded safety net.
- Client (`artifacts/mesurado-dashboard/src/lib/auth-context.tsx`) now uses a `parseJsonResponse` helper (reads text first, parses only if non-empty) instead of calling `res.json()` directly, so any future empty/non-JSON response surfaces a clear error instead of a cryptic parse exception.

## Why this matters going forward
Any Express `cors`/middleware error-callback pattern that throws (`callback(new Error(...))`) is risky on serverless (Vercel) deployments of this app — always prefer `callback(null, false)` plus a global JSON error handler. Also: Vercel env vars must be checked/set independently of Replit's — they do not sync automatically.
