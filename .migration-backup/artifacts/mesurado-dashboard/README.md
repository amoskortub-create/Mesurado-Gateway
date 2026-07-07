# Mesurado AI — Developer Dashboard & API Gateway

A full-stack Developer Dashboard and OpenAI-compatible API Gateway built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and **Appwrite**.

Built by **Media Tech Liberia** — [mediatechliberia.online](https://mediatechliberia.online)

---

## Features

- **Authentication** — Signup / Login via Appwrite with 1,000,000 free tokens per account
- **Overview** — Token balance, usage stats, 30-day area chart
- **Playground** — Browser-based chat interface with configurable temperature, system prompt, max tokens
- **API Keys** — Generate, reveal, and deactivate keys (`mesurado_sk_live_…`)
- **Usage Analytics** — Logs table, bar chart by key, API vs Playground pie chart
- **Billing** — Token progress bar, cost estimation, plan management
- **`/v1/chat/completions`** — OpenAI-compatible developer endpoint (Bearer auth)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui (Radix UI) |
| Charts | Recharts |
| Backend | Next.js API Routes |
| Database | Appwrite |
| Auth | Appwrite Account API + HMAC-signed session cookies |

---

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd mesurado-dashboard
pnpm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
APPWRITE_ENDPOINT=https://mediatechliberia.online/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key

APPWRITE_DATABASE_ID=mesurado

MESURADO_CORE_URL=https://your-ai-server.com
MESURADO_MASTER_TOKEN=your_master_token

SESSION_SECRET=<run: openssl rand -base64 48>
```

### 3. Appwrite Setup

In your Appwrite console:

**Create Database:** `mesurado`

**Create Collection:** `api_keys`
| Attribute | Type | Required | Notes |
|-----------|------|----------|-------|
| `user_id` | String | ✓ | Index it |
| `key_hash` | String | ✓ | Index, Unique — HMAC-SHA256 of the plaintext key |
| `key_prefix` | String | ✓ | First 24 chars of key — safe for display |
| `label` | String | ✓ | |
| `is_active` | Boolean | ✓ | Default: `true` |
| `created_at` | Datetime | ✓ | |

> **Security note:** Plaintext API keys are never stored. At key creation, the plaintext is returned once (not logged or persisted), and subsequent validation hashes the bearer token with `SESSION_SECRET` using HMAC-SHA256 and compares against `key_hash`.

**Create Collection:** `usage_logs`
| Attribute | Type | Required | Notes |
|-----------|------|----------|-------|
| `user_id` | String | ✓ | Index it |
| `key_id` | String | ✗ | |
| `source` | Enum | ✓ | `api`, `playground` |
| `prompt_tokens` | Integer | ✓ | |
| `completion_tokens` | Integer | ✓ | |
| `cost_debit` | Float | ✓ | |
| `timestamp` | Datetime | ✓ | Index it |

**Permissions for each collection:** Any authenticated user can read/write their own documents (or use server-side API key for full access).

### 4. Run Dev Server

```bash
pnpm dev
# or
PORT=3000 pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## API Reference

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | Create account |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Sign out |

### Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/keys/generate` | Generate a new API key |
| `GET` | `/api/keys/list` | List your keys |
| `DELETE` | `/api/keys/delete` | Deactivate a key |

### User

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/user/usage` | Token balance, logs, chart data |

### Playground

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/playground/chat` | Browser-based AI chat |

### Developer API (public)

```
POST /v1/chat/completions
Authorization: Bearer mesurado_sk_live_...
Content-Type: application/json

{
  "model": "mesurado-llama3.2-3b",
  "messages": [{ "role": "user", "content": "Hello!" }],
  "temperature": 0.75,
  "max_tokens": 500
}
```

Returns OpenAI-compatible JSON.

**Error codes:**
- `401` — Missing or invalid API key
- `402` — Token balance exhausted
- `502` — AI engine unreachable (retry)

---

## Deployment (Vercel)

```bash
vercel
```

Set environment variables in the Vercel dashboard matching `.env.example`.

**Important:** In Vercel → Settings → Functions, ensure Node.js 18+ runtime.

---

## Token Counting

Token estimation uses simple whitespace splitting:
```
tokens = text.split(/\s+/).length
```

This is approximate (~1.3× the true GPT token count for English text) and sufficient for billing at the stated rate.

**Pricing:** `$0.75 / 1,000,000 tokens`

---

## License

MIT — Media Tech Liberia
