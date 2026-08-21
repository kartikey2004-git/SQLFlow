import { createAuthClient } from "better-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Better Auth's routes are mounted on the Express API (apps/api), not on
 * this Next.js app, so every client call is cross-origin - `basePath` must
 * match the server's `basePath: "/auth"` (packages/auth/src/auth.ts) and
 * `credentials: "include"` keeps the session cookie flowing both ways, same
 * as the fetch-based service this replaces.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: "/auth",
  fetchOptions: {
    credentials: "include",
  },
});

/** Better Auth's `role` additional field isn't picked up by client type
 * inference across the package boundary - this mirrors what the server
 * actually returns (packages/auth/src/auth.ts `user.additionalFields`). */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: "student" | "instructor" | "admin";
  createdAt: string;
};
