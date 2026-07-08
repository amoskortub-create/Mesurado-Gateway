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
