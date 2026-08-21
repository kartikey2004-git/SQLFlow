import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@sql-learn/database";
import { PasswordService } from "./password.service";

const socialProviders: NonNullable<Parameters<typeof betterAuth>[0]["socialProviders"]> = {};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  };
}

/**
 * Single source of truth for authentication (replaces the former custom
 * session/password system). `generateId: "serial"` keeps every model's `id`
 * on Postgres's own bigserial sequence - the same scheme `users.id` already
 * used - so existing bigint FKs (assignments.created_by, attempts.user_id,
 * hint_requests.user_id) needed no changes.
 */
export const auth = betterAuth({
  appName: "SQL Learn",
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/auth",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : [],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  advanced: {
    database: {
      generateId: "serial",
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // Reuses the existing OWASP-tuned Argon2id (hash-wasm) implementation so
    // every pre-migration password hash keeps verifying with no forced reset.
    password: {
      hash: (password) => PasswordService.hash(password),
      verify: ({ hash, password }) => PasswordService.verify(hash, password),
    },
  },
  socialProviders,
  user: {
    modelName: "users",
    // Reuses the existing `display_name`/`created_at`/`updated_at` columns
    // instead of adding camelCase duplicates.
    fields: {
      name: "display_name",
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    additionalFields: {
      // Domain role (student/instructor/admin) - authorization stays app-owned;
      // `input: false` keeps it out of client-controlled sign-up payloads.
      role: { type: "string", input: false, defaultValue: "student" },
    },
    // Immediate deletion (no email confirmation step - out of scope, see
    // prompt.md section 10) once the password/session-freshness check in
    // Better Auth's own /delete-user endpoint passes.
    deleteUser: { enabled: true },
  },
  session: {
    modelName: "sessions",
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    modelName: "accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      idToken: "id_token",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "verifications",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  rateLimit: {
    // Always on (Better Auth otherwise only enables this in production) -
    // the old loginRateLimiter applied in every environment.
    enabled: true,
    customRules: {
      // Overrides Better Auth's built-in 3-per-10s default for these paths
      // with something closer to the old combined IP+email policy (8/20min).
      "/sign-in/email": { window: 60 * 20, max: 8 },
      "/sign-up/email": { window: 60 * 20, max: 8 },
    },
  },
});
