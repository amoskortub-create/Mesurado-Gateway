/**
 * Vercel serverless entry point — catch-all for everything under /api/*.
 *
 * This is a single named function (api/index.ts), not the `[...path].ts`
 * dynamic-segment filename convention. That convention was tried first and
 * silently failed to deploy as a function at all on this project — every
 * /api/* request fell through to the SPA's index.html rewrite instead
 * (confirmed empirically: a plain api/ping.ts file worked, api/[...path].ts
 * did not). Do not revert to the bracket-filename convention without
 * re-verifying it actually gets deployed as a function.
 *
 * Instead, vercel.json has an explicit rewrite:
 *   { "source": "/api/(.*)", "destination": "/api" }
 * which forwards every /api/* request to this one function. Vercel rewrites
 * preserve the original request path in req.url even though the destination
 * is just "/api" — this is the standard, documented pattern for running a
 * single Express app as a Vercel catch-all API function.
 *
 * The public /v1/* endpoint is handled via a separate vercel.json rewrite
 * that forwards /v1/:path* -> /api/v1/:path* (which then matches the /api/(.*)
 * rewrite above and lands here too). See artifacts/api-server/src/app.ts,
 * which mounts the v1 router at BOTH /v1 (standalone Node deployments) and
 * /api/v1 (this Vercel deployment).
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
