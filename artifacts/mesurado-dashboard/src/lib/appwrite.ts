import { Client, Account, Databases } from 'appwrite';

export const DATABASE_ID = 'mesurado';
export const COLLECTIONS = {
  API_KEYS:   'api_keys',
  USAGE_LOGS: 'usage_logs',
  PAYMENTS:   'payments',
} as const;

export const appwriteClient = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT ?? 'https://mediatechliberia.online/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID as string);

export const account  = new Account(appwriteClient);
export const databases = new Databases(appwriteClient);
