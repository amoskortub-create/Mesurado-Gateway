import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import router from "./routes/index.js";
import v1Router from "./routes/v1.js";
import { logger } from "./lib/logger.js";

const app = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: IncomingMessage & { id?: unknown }) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res: ServerResponse) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// Restrict CORS to known origins only.
// The public v1 API uses explicit per-route CORS headers (Access-Control-Allow-Origin: *)
// so the session-cookie routes never allow cross-origin credentials from arbitrary sites.
const ALLOWED_ORIGINS = (() => {
  // MESURADO_DOMAIN may be a single domain or a comma-separated list, e.g.
  // "mesurado.mediatechliberia.online,techliberia.online". Always include the
  // known production custom domain as a safety net so a misconfigured/missing
  // env var in a given deployment (e.g. Vercel) doesn't silently lock out the
  // real frontend with a CORS rejection.
  const domains = (process.env.MESURADO_DOMAIN ?? '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
    .concat(['mesurado.mediatechliberia.online']);
  const origins = new Set<string>([
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:22802',
  ]);
  for (const domain of domains) {
    origins.add(`https://${domain}`);
    origins.add(`http://${domain}`);
  }
  return origins;
})();

const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (!origin) return callback(null, true);
  if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
  // Allow *.replit.dev and *.replit.app for the dev preview proxy
  if (/\.replit\.(dev|app)$/.test(origin)) return callback(null, true);
  // IMPORTANT: never pass an Error here. Doing so makes the `cors` package call
  // next(err), which — with no error-handling middleware — can terminate the
  // request on serverless platforms (e.g. Vercel) with an EMPTY response body
  // instead of a proper CORS rejection. Returning `false` just omits the
  // Access-Control-Allow-Origin header, which the browser correctly blocks.
  logger.warn({ origin }, 'CORS: origin not in allow-list, rejecting');
  callback(null, false);
};

app.use(cors({ credentials: true, origin: corsOrigin }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dashboard API routes
app.use("/api", router);

// Public OpenAI-compatible endpoint.
// Mounted at both /v1 (standalone Node deployments, e.g. Railway/Render) and
// /api/v1 (Vercel single-deployment: vercel.json rewrites /v1/* -> /api/v1/*
// so it's served by the same catch-all function as /api/*, see api/[...path].ts).
app.use("/v1", v1Router);
app.use("/api/v1", v1Router);

// Fail-safe: guarantee every response is valid JSON, even for errors that
// escape a route's own try/catch (e.g. a thrown error in middleware). Without
// this, an uncaught error can reach Express's default HTML/empty-body error
// handler, which the frontend cannot parse via response.json() — surfacing as
// a confusing "Unexpected end of JSON input" error to the user.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err }, "[unhandled error]");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

export default app;
