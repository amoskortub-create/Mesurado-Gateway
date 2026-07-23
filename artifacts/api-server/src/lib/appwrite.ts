import { Client, Account, Databases, Users, Storage, Messaging, ID, Query } from 'node-appwrite';

export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID ?? 'mesurado';
export const STORAGE_BUCKET_ID = process.env.APPWRITE_STORAGE_BUCKET_ID ?? 'payment_screenshots';

export const COLLECTIONS = {
  API_KEYS:                    'api_keys',
  USAGE_LOGS:                  'usage_logs',
  PAYMENTS:                    'payments',
  RATE_LIMITS:                 'rate_limits',
  GATEKEEPER_SLOTS:            'gatekeeper_slots',
  REQUEST_QUEUE:               'request_queue',
  RATE_LIMIT_OVERRIDES:        'rate_limit_overrides',
  ADMINS:                      'admins',
  PLAYGROUND_CONVERSATIONS:    'playground_conversations',
  REJECTED_LOGS:               'rejected_logs',
} as const;

export { ID, Query };

/** Admin client — API-key auth, for all server-side operations */
export const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT ?? 'https://mediatechliberia.online/v1';
export const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? 'mesurado01';

export function createAdminClient() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY!);
  return {
    account: new Account(client),
    databases: new Databases(client),
    users: new Users(client),
    storage: new Storage(client),
    messaging: new Messaging(client),
  };
}

/** Auth client — no API key, used ONLY for createEmailPasswordSession */
export function createAuthClient() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);
  return { account: new Account(client) };
}

export type UserPrefs = {
  mesurado_tokens_remaining: number;
  mesurado_plan: 'free' | 'payg';
  mesurado_total_tokens_used: number;
  mesurado_total_purchased: number;
};

export const DEFAULT_PREFS: UserPrefs = {
  mesurado_tokens_remaining: 100_000,
  mesurado_plan: 'free',
  mesurado_total_tokens_used: 0,
  mesurado_total_purchased: 0,
};

/**
 * Check if a user is an administrator.
 *
 * Two sources are checked (either is sufficient):
 *   1. `admins` Appwrite collection — add a document with the user's `user_id`
 *      field in Database → mesurado → admins. This is the recommended way.
 *   2. Appwrite user label `'Administrator'` — legacy fallback.
 *
 * Both checks are performed in parallel for speed.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const { users, databases } = createAdminClient();

    const [userResult, collectionResult] = await Promise.allSettled([
      users.get(userId),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.ADMINS, [
        Query.equal('user_id', userId),
        Query.limit(1),
      ]),
    ]);

    // Collection check (preferred)
    if (
      collectionResult.status === 'fulfilled' &&
      collectionResult.value.total > 0
    ) {
      return true;
    }

    // Label fallback
    if (
      userResult.status === 'fulfilled' &&
      Array.isArray(userResult.value.labels) &&
      userResult.value.labels.includes('Administrator')
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
