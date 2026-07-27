import https from 'node:https';
import { Readable } from 'node:stream';

/**
 * Returns the Mesurado Engine Core base URL from the MESURADO_CORE_URL
 * environment variable (set as a Replit Secret).
 *
 * Returns undefined when the secret is absent; callers must respond with
 * a 503 misconfiguration error in that case.
 */
export function resolveCoreUrl(): string | undefined {
  return process.env.MESURADO_CORE_URL || 'https://ai.mediatechliberia.online:8443';
}

/**
 * A fetch()-compatible wrapper for requests to the Mesurado AI core.
 *
 * When ALLOW_INSECURE_CORE=true it uses Node's https module with a custom
 * Agent that sets rejectUnauthorized=false — the only reliable way to bypass
 * self-signed cert rejection in Node ≥18 where native fetch() uses undici's
 * own TLS stack and does NOT honour NODE_TLS_REJECT_UNAUTHORIZED.
 *
 * When ALLOW_INSECURE_CORE is not set it falls through to native fetch().
 */
export async function coreFetch(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  } = {},
): Promise<{ ok: boolean; status: number; body: ReadableStream<Uint8Array> | null }> {
  if (process.env.ALLOW_INSECURE_CORE !== 'true') {
    return fetch(url, init as RequestInit) as Promise<{
      ok: boolean;
      status: number;
      body: ReadableStream<Uint8Array> | null;
    }>;
  }

  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const agent = new https.Agent({ rejectUnauthorized: false });

    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: init.method ?? 'GET',
        headers: init.headers ?? {},
        agent,
      },
      (res) => {
        const ok =
          res.statusCode !== undefined &&
          res.statusCode >= 200 &&
          res.statusCode < 300;
        // Convert Node.js Readable → Web ReadableStream (Node ≥18)
        const body = Readable.toWeb(res) as ReadableStream<Uint8Array>;
        resolve({ ok, status: res.statusCode ?? 500, body });
      },
    );

    req.on('error', reject);

    if (init.signal) {
      init.signal.addEventListener('abort', () => req.destroy(new Error('AbortError')));
    }

    if (init.body) {
      req.write(init.body);
    }
    req.end();
  });
}

/**
 * Validates MESURADO_CORE_URL at startup.
 *
 * Always throws on HTTP — in both development and production.
 * The MESURADO_MASTER_TOKEN is a high-value credential forwarded in every
 * AI request header; transmitting it over plaintext HTTP exposes it to any
 * network observer between this server and the inference engine.
 *
 * To allow an HTTP engine temporarily during local development, set:
 *   ALLOW_HTTP_CORE=true
 * in your environment. This must NEVER be set in production.
 */
export function validateCoreUrl(): void {
  const url = resolveCoreUrl();

  if (!url) {
    throw new Error(
      "MESURADO_CORE_URL is not set. The AI gateway cannot forward requests without a core engine URL.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`MESURADO_CORE_URL is not a valid URL: "${url}"`);
  }

  if (parsed.protocol !== "https:") {
    const isAllowed =
      process.env.ALLOW_HTTP_CORE === "true" &&
      process.env.NODE_ENV !== "production";

    const message =
      `MESURADO_CORE_URL uses plaintext HTTP ("${url}"). ` +
      `MESURADO_MASTER_TOKEN is forwarded in every AI request header — ` +
      `any network observer between this server and the inference engine can capture it. ` +
      `Point MESURADO_CORE_URL at an HTTPS endpoint to fix this.`;

    if (isAllowed) {
      console.warn(`\n⚠️  [SECURITY WARNING] ${message}`);
      console.warn(
        `⚠️  ALLOW_HTTP_CORE=true is set — HTTP engine allowed for local dev only.\n`,
      );
    } else {
      throw new Error(
        `[startup blocked] ${message}\n` +
        `Set ALLOW_HTTP_CORE=true (dev only) to override, or update MESURADO_CORE_URL to HTTPS.`,
      );
    }
  }
}
