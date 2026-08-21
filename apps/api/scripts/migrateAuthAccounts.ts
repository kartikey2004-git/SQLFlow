/**
 * One-off backfill: creates the Better Auth `accounts` row every pre-migration
 * user needs to keep signing in with their existing Argon2id password hash.
 *
 * Better Auth stores email/password credentials as an `accounts` row (not on
 * `users` directly): providerId "credential", accountId equal to the user's
 * own id (as a string), issuer "local:credential", password holding the
 * hash - verified empirically against better-auth's sign-up handler
 * (linkAccount call in dist/api/routes/sign-up.mjs), not assumed from
 * documentation.
 *
 * Idempotent: skips users that already have a credential account, so it's
 * safe to re-run.
 *
 * Run with: bun run apps/api/scripts/migrateAuthAccounts.ts
 */
import "dotenv/config";
import { prisma } from "@sql-learn/database";

const CREDENTIAL_PROVIDER_ID = "credential";
const CREDENTIAL_ISSUER = "local:credential";

const migrateAuthAccounts = async () => {
  const users = await prisma.users.findMany({
    select: { id: true, email: true, password_hash: true },
  });

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    const existing = await prisma.accounts.findFirst({
      where: { user_id: user.id, provider_id: CREDENTIAL_PROVIDER_ID },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.accounts.create({
      data: {
        user_id: user.id,
        account_id: String(user.id),
        provider_id: CREDENTIAL_PROVIDER_ID,
        issuer: CREDENTIAL_ISSUER,
        password: user.password_hash,
      },
    });
    migrated++;
    console.log(`Migrated credential account for ${user.email} (user_id=${user.id})`);
  }

  console.log(`Done. ${migrated} account(s) created, ${skipped} already had one.`);
};

migrateAuthAccounts()
  .catch((err) => {
    console.error("migrateAuthAccounts failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
