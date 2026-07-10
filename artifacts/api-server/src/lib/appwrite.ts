import { Client, Account, Databases, Users, Storage, Messaging, ID, Query } from 'node-appwrite';

export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID ?? 'mesurado';
export const STORAGE_BUCKET_ID = process.env.APPWRITE_STORAGE_BUCKET_ID ?? 'payment_screenshots';

export const COLLECTIONS = {
  API_KEYS: 'api_keys',
  USAGE_LOGS: 'usage_logs',
  PAYMENTS: 'payments',
} as const;

export { ID, Query };

/** Admin client — API-key auth, for all server-side operations */
export function createAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT_ID!)
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
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT_ID!);
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

/** Check if a user has the Administrator label */
export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const { users } = createAdminClient();
    const user = await users.get(userId);
    return Array.isArray(user.labels) && user.labels.includes('Administrator');
  } catch {
    return false;
  }
}
