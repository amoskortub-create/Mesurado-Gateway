/**
 * Mesurado user management CLI
 *
 * Usage:
 *   node scripts/manage-user.mjs set-admin <email>
 *   node scripts/manage-user.mjs remove-admin <email>
 *   node scripts/manage-user.mjs add-tokens <email> <amount>
 *   node scripts/manage-user.mjs info <email>
 *
 * Examples:
 *   node scripts/manage-user.mjs set-admin admin@example.com
 *   node scripts/manage-user.mjs add-tokens user@example.com 5000000
 *   node scripts/manage-user.mjs info user@example.com
 */

import { Client, Users, Query } from 'node-appwrite';

const [, , command, emailArg, extraArg] = process.argv;

const VALID_COMMANDS = ['set-admin', 'remove-admin', 'add-tokens', 'info'];
if (!command || !VALID_COMMANDS.includes(command) || !emailArg) {
  console.error(`
Usage:
  node scripts/manage-user.mjs set-admin <email>
  node scripts/manage-user.mjs remove-admin <email>
  node scripts/manage-user.mjs add-tokens <email> <amount>
  node scripts/manage-user.mjs info <email>
`);
  process.exit(1);
}

const endpoint = process.env.APPWRITE_ENDPOINT ?? 'https://mediatechliberia.online/v1';
const projectId = process.env.APPWRITE_PROJECT_ID ?? 'mesurado01';
const apiKey   = process.env.APPWRITE_API_KEY;

if (!apiKey) {
  console.error('❌  APPWRITE_API_KEY is not set');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const users = new Users(client);

// ── find user by email ────────────────────────────────────────────────────────
async function findUser(email) {
  const result = await users.list([Query.equal('email', email)]);
  if (result.total === 0) {
    console.error(`❌  No user found with email: ${email}`);
    process.exit(1);
  }
  return result.users[0];
}

// ── commands ──────────────────────────────────────────────────────────────────
if (command === 'info') {
  const user = await findUser(emailArg);
  const prefs = user.prefs ?? {};
  console.log(`
User: ${user.name} <${user.email}>
ID:   ${user.$id}
Labels: ${user.labels?.length ? user.labels.join(', ') : '(none)'}

Token balance:      ${(prefs.mesurado_tokens_remaining ?? 0).toLocaleString()}
Plan:               ${prefs.mesurado_plan ?? 'free'}
Total tokens used:  ${(prefs.mesurado_total_tokens_used ?? 0).toLocaleString()}
Total purchased:    ${(prefs.mesurado_total_purchased ?? 0).toLocaleString()}
`);
}

if (command === 'set-admin') {
  const user = await findUser(emailArg);
  const existingLabels = user.labels ?? [];
  if (existingLabels.includes('Administrator')) {
    console.log(`⚠️   ${emailArg} is already an Administrator`);
    process.exit(0);
  }
  await users.updateLabels(user.$id, [...existingLabels, 'Administrator']);
  console.log(`✅  ${emailArg} is now an Administrator`);
}

if (command === 'remove-admin') {
  const user = await findUser(emailArg);
  const newLabels = (user.labels ?? []).filter(l => l !== 'Administrator');
  await users.updateLabels(user.$id, newLabels);
  console.log(`✅  Administrator label removed from ${emailArg}`);
}

if (command === 'add-tokens') {
  const amount = Number(extraArg);
  if (!extraArg || isNaN(amount) || amount <= 0) {
    console.error('❌  Provide a positive token amount, e.g.: add-tokens user@example.com 5000000');
    process.exit(1);
  }
  const user = await findUser(emailArg);
  const prefs = user.prefs ?? {};
  const current = Number(prefs.mesurado_tokens_remaining ?? 0);
  const newPrefs = {
    ...prefs,
    mesurado_tokens_remaining: current + amount,
    mesurado_total_purchased: Number(prefs.mesurado_total_purchased ?? 0) + amount,
    mesurado_plan: String(prefs.mesurado_plan ?? 'free') === 'free' ? 'payg' : prefs.mesurado_plan,
  };
  await users.updatePrefs(user.$id, newPrefs);
  console.log(`✅  Added ${amount.toLocaleString()} tokens to ${emailArg}`);
  console.log(`    New balance: ${newPrefs.mesurado_tokens_remaining.toLocaleString()}`);
}
