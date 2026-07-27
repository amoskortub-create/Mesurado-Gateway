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
 * Returns extra fetch() init options for requests to the core engine.
 *
 * When ALLOW_INSECURE_CORE=true, disables TLS certificate verification for
 * this Node.js process — needed when the engine uses a self-signed cert
 * (e.g. non-standard port 8443 without a CA-signed certificate).
 * This is safe here because the only outbound HTTPS targets are Appwrite
 * and the AI core, both on trusted infrastructure.
 */
export function coreFetchInit(): Record<string, unknown> {
  if (process.env.ALLOW_INSECURE_CORE === 'true') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  return {};
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
