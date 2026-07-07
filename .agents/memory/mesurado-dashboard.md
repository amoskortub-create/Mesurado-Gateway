---
name: Mesurado AI Dashboard
description: Key architecture decisions for the Next.js 14 + Appwrite developer dashboard at artifacts/mesurado-dashboard
---

## Auth
- Uses custom HMAC-signed session tokens (not Appwrite session cookies) stored as `mesurado_session` httpOnly cookie.
- `SESSION_SECRET` env var is required for both session signing and API key hashing.
- Signup uses `createAdminClient()` → `users.create()` + `users.updatePrefs()` for default token balance.
- Login uses `createAuthClient()` → `account.createEmailPasswordSession()` for credential validation.

**Why:** Appwrite session cookies are unreliable to manage server-side across node-appwrite versions; HMAC tokens give full control.

## API Key Security
- Plaintext keys (`mesurado_sk_live_` + 32 hex chars) are NEVER stored in Appwrite.
- Storage: `key_hash` (HMAC-SHA256 of plaintext using SESSION_SECRET) + `key_prefix` (first 24 chars for display).
- Validation: hash the incoming bearer token, query by `key_hash`.
- `src/lib/key-hash.ts` — server-only (uses process.env.SESSION_SECRET); `maskKeyPrefix()` lives in `utils.ts` (client-safe).

**Why:** Plaintext storage means a DB leak exposes all customer keys immediately.

## Quota / Token Accounting
- Pre-charge pattern: deduct `prompt_tokens + max_tokens` (worst case) from balance BEFORE calling AI.
- After AI responds, refund unused tokens: `refund = max_estimate - actual_total`.
- This prevents overdraft without true DB transactions (Appwrite doesn't support them).
- Concurrent requests still have a race window (known limitation — documented in README).

**Why:** Simple post-call deduction allows overdraft on concurrent requests; pre-charge minimizes it.

## Routing
- api-server artifact was moved from path `/api` to `/api-service` so Next.js owns `/api/*`.
- `src/middleware.ts` passes `/api/*` and `/v1/*` through without auth redirect.
- `/v1/chat/completions` is the public developer endpoint with CORS headers.

## Appwrite Schema
- Database ID: `mesurado` (env `APPWRITE_DATABASE_ID`)
- Collection `api_keys`: `user_id`, `key_hash` (Unique), `key_prefix`, `label`, `is_active`, `created_at`
- Collection `usage_logs`: `user_id`, `key_id`, `source` (api|playground), `prompt_tokens`, `completion_tokens`, `cost_debit`, `timestamp`
- User prefs (not a collection): `mesurado_tokens_remaining`, `mesurado_plan`, `mesurado_total_tokens_used`

## Tailwind v4
- Uses `@import 'tailwindcss'` in globals.css (NOT `@tailwind base/components/utilities`)
- Uses `@tailwindcss/postcss` in postcss.config.js (NOT vite plugin)
- CSS variables defined in `:root` and `.dark`; Tailwind `@theme inline` maps them to `--color-*`

## Package Notes
- `appwrite` (web SDK) was removed — only `node-appwrite` is needed (all ops are server-side)
- React 18 pinned (not catalog) for Next.js 14 compat
- Recharts 2.x installed (3.x migration not yet done)
