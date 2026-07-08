---
name: Mesurado rate-limit + queue system
description: Three-layer server-side protection for /api/playground/chat and /v1/chat/completions
---

## What was built

Three server-side protection layers added to both /api/playground/chat and /v1/chat/completions:

**Layer 1 — Per-user rate limit**
- Redis INCR+EXPIRE pattern (60s window)
- Playground: rate-limited by userId; v1: by API key document ID with userId override lookup
- Free users: 10 req/min; Paid: 60 req/min (env overridable via RATE_LIMIT_FREE_PER_MINUTE etc.)
- Admin can set per-user override stored at `rate_limit_override:{userId}` in Redis
- Falls back to in-memory Map if Redis/Upstash unavailable

**Layer 2 — Global concurrency queue**
- In-memory Promise-based semaphore (single-process, reliable for persistent Node.js server)
- MAX_CONCURRENT_GATEKEEPER=3 slots; MAX_QUEUE_SIZE=10; QUEUE_TIMEOUT_MS=20000
- FIFO — oldest queued request gets next slot; queue is drained in drain() after each release
- `gatekeeperQueue.acquire()` returns one-shot release(); release() guaranteed via try/finally

**Layer 3 — Per-request timeout**
- setTimeout inside the queue rejects the waiting Promise after TIMEOUT_MS

## Billing safety

Pre-charge rollback is guaranteed on ALL failure paths:
- `preChargeApplied` flag: set true after Appwrite updatePrefs for pre-charge succeeds
- `reconciled` flag: set true after billing block runs (success or logged error)
- In try/finally: if preChargeApplied && !reconciled → restore original balance via updatePrefs

## Streaming (playground)

SSE format: `data: {type, ...}\n\n`
Events: queue | start | token | done | error | [DONE]
Buffer full completion text for billing; release concurrency slot BEFORE billing

## v1 streaming

stream=true: forwards raw Ollama SSE chunks verbatim (OpenAI-compatible format)
stream=false: buffers full response, returns OpenAI JSON format

## FetchResponse type alias

Both playground.ts and v1.ts: `type FetchResponse = Awaited<ReturnType<typeof fetch>>`
Prevents name collision with Express's Response import.

## New files

- src/lib/redis.ts — Upstash REST client + in-memory Map fallback
- src/lib/rate-limiter.ts — checkRateLimit(), setRateLimitHeaders(), override CRUD
- src/lib/gatekeeper-queue.ts — GatekeeperQueue singleton, QueueFullError, QueueTimeoutError
- src/routes/admin-queue.ts — GET queue-status, POST clear-queue, POST adjust-rate-limit

## Admin endpoints (require Administrator Appwrite label)

- GET /api/admin/queue-status
- POST /api/admin/clear-queue
- POST /api/admin/adjust-rate-limit — body: {user_id, new_limit, action: "set"|"clear"}

**Why in-memory queue:** This is a persistent Node.js server (not Vercel serverless), so in-memory state survives across requests within the same process. Redis is used for rate limits (atomic, distributed-safe) but queue liveness is handled in-process.
