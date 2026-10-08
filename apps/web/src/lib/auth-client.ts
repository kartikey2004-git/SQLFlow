import { createAuthClient } from "better-auth/react";

import { AUTH_URL } from "@/lib/config";

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  basePath: "/auth",
  fetchOptions: {
    credentials: "include",
  },
});

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: "student" | "instructor" | "admin";
  createdAt: string;
};
