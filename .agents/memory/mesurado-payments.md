---
name: Mesurado MTN Mobile Money payment system
description: Architecture, setup requirements, and business rules for the manual payment system.
---

## What was built
Server-side manual MTN Mobile Money payment system. No automated verification — admin reviews proof and approves manually.

## Appwrite setup required (before production use)
1. **Database collections** (`mesurado` database):
   - `payments` collection with attributes: user_id, user_email, unique_code, amount_usd, ussd_code, status, proof_submitted (bool), proof_transaction_id, proof_phone_number, proof_screenshot_url, proof_screenshot_file_id, expires_at, reviewed_at, reviewed_by, admin_note
   - Index on: user_id, unique_code, status, expires_at

2. **Storage bucket** `payment_screenshots` — images only, max 5MB

3. **Admin user** — give the admin Appwrite user a label `Administrator` via Appwrite console. The backend checks `user.labels.includes('Administrator')` for all admin endpoints.

## Environment variables needed
- `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, `APPWRITE_DATABASE_ID` — existing
- `APPWRITE_STORAGE_BUCKET_ID` — defaults to `payment_screenshots`
- `ADMIN_EMAIL` — receives proof-submitted notifications
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — optional, for email notifications; if not set, emails are logged to console

## Business rules (immutable)
- USSD format: `15611108893221882{amount_usd}{unique_code}#`
- Merchant: Amos Kortu, 0889322188
- Token calc: `floor(amount_usd / 0.75 * 1_000_000)`
- USD only — no LRD, no exchange rates
- Rate limit: 5 payment generations/hour per user (in-memory)
- Status flow: `pending` → `paid` (proof submitted) → `approved` or `rejected`
- Rejection only allowed from `paid` state (not `pending`)
- Approval updates payment status FIRST (before token credit) to prevent double-credit race

## Key files
- `artifacts/api-server/src/routes/payments.ts` — generate, proof, my-payments
- `artifacts/api-server/src/routes/admin-payments.ts` — admin list, approve, reject
- `artifacts/api-server/src/lib/email.ts` — email templates
- `artifacts/api-server/src/lib/rate-limit.ts` — in-memory rate limiter
- `artifacts/mesurado-dashboard/src/pages/add-funds.tsx` — full payment flow UI
- `artifacts/mesurado-dashboard/src/pages/admin-payments.tsx` — admin panel

**Why:** Admin role check uses Appwrite `user.labels.includes('Administrator')` — NOT a custom attribute or prefs field. The label must be set from the Appwrite console.
