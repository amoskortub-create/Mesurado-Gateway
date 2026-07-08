---
name: Mesurado mock-vs-real split
description: All mock data is gone — the app is fully connected to Appwrite. Documents the auth architecture and real-time pattern.
---

## Status
All mock data is deleted. The app is live on real Appwrite.

## Deleted files
- `src/lib/mock.ts` — MOCK_USER, MOCK_USAGE, MOCK_API_KEYS, MOCK_USAGE_LOGS, getMockChatResponse
- `src/lib/device-store.ts` — fake Liberian IP, localStorage account registry
- `src/lib/search.ts` — mock search, mockSearch(), getSearchAiResponse()

## New files
- `src/lib/appwrite.ts` — Appwrite Client, Account, Databases; reads VITE_APPWRITE_ENDPOINT / VITE_APPWRITE_PROJECT_ID
- `src/hooks/use-usage.ts` — fetches GET /api/user/usage, subscribes to Appwrite real-time on usage_logs collection

## Auth architecture (dual-session)
Login calls BOTH:
1. `POST /api/auth/login` (api-server) → sets HMAC cookie `mesurado_session` (30-day)
2. `account.createEmailPasswordSession()` (Appwrite SDK) → Appwrite browser session cookie (for real-time subscriptions)

On mount, auth-context ALWAYS probes `GET /api/auth/me` to hydrate/clear state — does not rely solely on sessionStorage.
Logout clears both the HMAC cookie and Appwrite session.

## Real-time pattern
Both `use-usage.ts` and `api-keys.tsx` subscribe to Appwrite collections and call `refetch()` on events. Subscriptions are guarded (try/catch) and cleaned up on unmount. If the Appwrite session is missing, subscriptions degrade gracefully (polling only).

## Playground API contract
Frontend sends: `{ messages, temperature, max_tokens, system_prompt }` (snake_case, top-level).
Server validates exactly these fields via zod — do NOT nest under `settings`.

**Why:** Code review caught a contract mismatch where the frontend was sending `{ settings: { temperature, maxTokens } }` while the server expected flat fields. Fix applied.
