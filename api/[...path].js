/**
 * Vercel serverless entry point — catch-all for everything under /api/*.
 *
 * Because this file uses the [...path] dynamic-segment convention, Vercel
 * automatically invokes it for ANY request under /api/ (e.g. /api/auth/login,
 * /api/user/usage) with the original request path intact in req.url — no
 * rewrite needed for those.
 *
 * The public /v1/* endpoint is handled via a vercel.json rewrite that forwards
 * /v1/:path* -> /api/v1/:path* (Vercel rewrites replace the path, they don't
 * preserve the literal source path unless re-inserted via a named param), so
 * it also lands here. See artifacts/api-server/src/app.ts, which mounts the
 * v1 router at BOTH /v1 (standalone Node deployments) and /api/v1 (this
 * Vercel deployment).
 *
 * Caveats vs. the standalone Node process (artifacts/api-server):
 *  - The in-memory concurrency queue and rate limiter (see
 *    artifacts/api-server/src/lib/gatekeeper-queue.ts and rate-limiter.ts)
 *    reset per cold start and are NOT shared across concurrent serverless
 *    instances. Rate limiting / queueing will be best-effort only, not exact.
 *  - Streaming (SSE) responses are subject to the function's maxDuration
 *    (see vercel.json) — long completions may be cut off on lower plans.
 */
// Imports the pre-built, bundled JS output (produced by
// `pnpm --filter @workspace/api-server run build`, wired into this project's
// vercel.json buildCommand) rather than raw TypeScript source. Importing the
// raw source here would pull all of artifacts/api-server's files into this
// root project's tsconfig type-check scope during Vercel's build, using
// settings (lib/module resolution) that don't match api-server's own
// tsconfig — that mismatch was the cause of repeated, hard-to-reproduce
// Express type errors on Vercel. The bundled JS output has no such concern.
// @ts-expect-error -- plain bundled JS output, no declaration file by design.
import app from "../artifacts/api-server/dist/app.mjs";
export default app;
