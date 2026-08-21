"use client";

import { createContext, useContext, useCallback, useMemo } from "react";
import type { User } from "@sql-learn/types";
import { authClient, type AuthUser } from "@/lib/auth-client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const toUser = (authUser: AuthUser): User => ({
  id: Number(authUser.id),
  email: authUser.email,
  displayName: authUser.name,
  role: authUser.role,
  createdAt: authUser.createdAt,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending, refetch } = authClient.useSession();

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const logout = useCallback(async () => {
    await authClient.signOut();
    await refetch();
  }, [refetch]);

  const user = useMemo(
    () => (session?.user ? toUser(session.user as unknown as AuthUser) : null),
    [session],
  );

  return (
    <AuthContext.Provider value={{ user, loading: isPending, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
