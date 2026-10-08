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
