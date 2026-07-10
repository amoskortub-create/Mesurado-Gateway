/**
 * Returns the Mesurado Engine Core base URL from the MESURADO_CORE_URL
 * environment variable (set as a Replit Secret so it works across all
 * deployments without being hardcoded).
 *
 * Returns undefined when the secret is absent; callers must respond with
 * a 503 misconfiguration error in that case.
 */
export function resolveCoreUrl(): string | undefined {
  return process.env.MESURADO_CORE_URL || undefined;
}

/**
 * Validates MESURADO_CORE_URL at startup.
 *
 * - In production: throws if the URL is missing or not HTTPS (master token
 *   would otherwise be transmitted in plaintext over the network).
 * - In development: logs a warning for HTTP so developers are aware, but
 *   does not block startup (allows testing against local/HTTP engines).
 */
export function validateCoreUrl(): void {
  const url = resolveCoreUrl();
  const isDev = process.env.NODE_ENV !== "production";

  if (!url) {
    throw new Error(
      "MESURADO_CORE_URL is not set. The AI gateway cannot forward requests without a core engine URL.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `MESURADO_CORE_URL is not a valid URL: "${url}"`,
    );
  }

  if (parsed.protocol !== "https:") {
    const message =
      `MESURADO_CORE_URL uses ${parsed.protocol.replace(":", "").toUpperCase()} ("${url}"). ` +
      `The master token (MESURADO_MASTER_TOKEN) is forwarded to this host in request headers. ` +
      `Use an HTTPS endpoint to prevent credential exposure in transit.`;

    if (isDev) {
      // Warn but allow in development so local/HTTP engines still work.
      console.warn(`[security warning] ${message}`);
    } else {
      throw new Error(`[startup error] ${message}`);
    }
  }
}
