---
name: Mesurado Vercel auth crash (empty JSON response)
description: Root cause and fix for "Unexpected end of JSON input" on login/signup in the Vercel-deployed Mesurado dashboard.
---

## Symptom
Production (Vercel, custom domain techliberia.online) showed "Failed to execute 'json' on 'Response': Unexpected end of JSON input" on the sign-in and sign-up screens. Same code ran fine in the Replit dev workflow.

## Root cause (the actual one, confirmed via Vercel API + live curl tests)
Two stacked bugs, both on the Vercel deployment side (mesurado-gateway project, custom domain `mesurado.mediatechliberia.online`):

1. **The real cause of the empty-JSON crash**: `api/[...path].ts` (Vercel's bracket dynamic-segment filename convention for a catch-all API route) was never actually deployed as a function on this project. Confirmed empirically: a plain named file (`api/ping.ts`) worked immediately, but `/api/anything-nested` (e.g. `/api/auth/login`) fell through to the SPA's `index.html` rewrite for every request — GET returned the HTML shell (200), POST returned an empty 405 (static assets don't accept POST), which is exactly what produces "Unexpected end of JSON input" client-side. The Vercel build logs never mentioned processing `/api` at all when this convention was used — no error, it just silently never became a function.
   - **Fix**: renamed to a plain `api/index.ts` and added an explicit `vercel.json` rewrite `{ "source": "/api/(.*)", "destination": "/api" }` (placed before the SPA catch-all). This is the standard, reliable Vercel+Express single-function pattern — Vercel rewrites preserve the original request path in `req.url` even though the destination is just `/api`, so Express's own routing still works unmodified.
   - **Lesson**: don't trust the `[...param].ts` catch-all filename convention for a plain Vercel Functions (non-Next.js) project without verifying with a real deployed request that nested paths actually reach it — it can silently fail to register with zero build-time errors.

2. **`MESURADO_DOMAIN` was never set in Vercel's project env vars at all** (confirmed via `GET /v9/projects/{id}/env` — only `APPWRITE_API_KEY`, `MESURADO_MASTER_TOKEN`, `MESURADO_CORE_URL` existed). This meant the CORS allow-list only had localhost origins in production, so real requests from `mesurado.mediatechliberia.online` were rejected. Compounded by the CORS origin-check calling `callback(new Error(...))` on rejection, which throws inside the `cors` middleware and (with no error-handling middleware registered) could reach Vercel's serverless boundary as a broken response instead of a clean CORS block.
   - **Fix**: CORS origin check now calls `callback(null, false)` (clean rejection, no throw). Added a global 4-arg Express error-handling middleware at the end of `app.ts` guaranteeing every response is valid JSON. Set `MESURADO_DOMAIN=mesurado.mediatechliberia.online` (plus the other missing `APPWRITE_ENDPOINT`/`APPWRITE_PROJECT_ID`/`APPWRITE_DATABASE_ID`/`SESSION_SECRET`) directly in Vercel via the Projects API. `ALLOWED_ORIGINS` in code also always includes `mesurado.mediatechliberia.online` as a hardcoded fallback regardless of the env var.
   - **Lesson**: Vercel env vars are configured *per Vercel project*, entirely separate from Replit secrets — always verify via `GET /v9/projects/{id}/env` (with a valid Vercel token) rather than assuming a Replit-side env var was carried over.

Client-side hardening (defense in depth, not the root cause but worth keeping): `artifacts/mesurado-dashboard/src/lib/auth-context.tsx` now uses a `parseJsonResponse` helper (reads text first, parses only if non-empty) instead of calling `res.json()` directly, so any future empty/non-JSON response surfaces a clear error instead of a cryptic parse exception.

## Debugging method that worked
Vercel's REST API (`api.vercel.com`) was usable directly with a user-provided personal token: list projects/deployments, read/patch env vars, fetch build logs (`/v3/deployments/{id}/events`), and trigger redeploys. This let me confirm the real production behavior (curl-equivalent fetches against the live domain) instead of guessing from local dev, which never reproduced the bug since Vercel's rewrite/function routing only exists in that deployment.
