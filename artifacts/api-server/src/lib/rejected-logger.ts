/**
 * Fire-and-forget helper to record rejected requests in Appwrite.
 * Never throws — logging failures must never affect the HTTP response.
 */
import { createAdminClient, DATABASE_ID, COLLECTIONS, ID } from './appwrite.js';

export async function logRejection(
  userId: string,
  source: 'api' | 'playground',
  reason: string,
  errorCode: number,
): Promise<void> {
  try {
    const { databases } = createAdminClient();
    await databases.createDocument(DATABASE_ID, COLLECTIONS.REJECTED_LOGS, ID.unique(), {
      user_id:    userId,
      source,
      reason,
      error_code: errorCode,
      timestamp:  new Date().toISOString(),
    });
  } catch {
    // Intentionally silenced — rejection logging is best-effort
  }
}
