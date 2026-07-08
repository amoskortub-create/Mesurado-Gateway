---
name: Mesurado mock vs real split
description: How the Mesurado AI Dashboard prototype separates mock mode from the real backend.
---

# Mock / Real Split Architecture

**Why:** User requested a fully mock prototype with no backend and no real auth so they could verify all UI without setting up Appwrite or the LLM engine.

**How to apply:** When switching from prototype to real backend, only these files need to change:

| File | Current (mock) | Real build |
|------|---------------|------------|
| `src/lib/auth-context.tsx` | sessionStorage flag, any creds work | Replace login/logout with real `/api/auth/*` fetch calls |
| `src/lib/mock.ts` | Static mock data + canned chat responses | Delete or gate behind `import.meta.env.DEV` |
| `src/pages/overview.tsx` | Imports directly from mock.ts | Replace with `useQuery(() => fetch('/api/user/usage'))` |
| `src/pages/analytics.tsx` | Same | Same |
| `src/pages/api-keys.tsx` | Local useState over mock keys | Replace with react-query + `/api/keys/*` |
| `src/pages/billing.tsx` | Same | Same |
| `src/components/playground/chat-interface.tsx` | Calls getMockChatResponse() | Replace with `fetch('/api/playground/chat', ...)` |

All dashboard page components receive data as props or read from context — no backend URLs are hard-coded outside of the component fetch calls, making the swap clean.

**Express routes are already written** in `artifacts/api-server/src/routes/` and just need Appwrite env vars to go live.
