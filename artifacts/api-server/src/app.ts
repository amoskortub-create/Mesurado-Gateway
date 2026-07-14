import express from "express";
import type { Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import router from "./routes/index.js";
import v1Router from "./routes/v1.js";
import { logger } from "./lib/logger.js";

const app: Application = express();

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
  const domain = process.env.MESURADO_DOMAIN;
  const origins = new Set<string>([
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:22802',
  ]);
  if (domain) {
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
  callback(new Error(`CORS: origin not allowed — ${origin}`));
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

export default app;
