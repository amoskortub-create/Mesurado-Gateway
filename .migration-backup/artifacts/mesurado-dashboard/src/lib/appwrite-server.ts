import { Client, Account, Databases, Users, ID, Query } from 'node-appwrite';

export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID ?? 'mesurado';

export const COLLECTIONS = {
  API_KEYS: 'api_keys',
  USAGE_LOGS: 'usage_logs',
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
};

export const DEFAULT_PREFS: UserPrefs = {
  mesurado_tokens_remaining: 1_000_000,
  mesurado_plan: 'free',
  mesurado_total_tokens_used: 0,
};
