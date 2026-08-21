"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@sql-learn/ui/components/button";

export default function NavBar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <nav className="flex items-center justify-between border-b border-surface-dark-border bg-surface-dark px-8 py-4 text-gray-200">
      <Link href="/" className="text-[1.1rem] font-semibold text-white">
        SQL Learn
      </Link>
      <div className="flex items-center gap-4">
        {loading ? null : user ? (
          <>
            <Link href="/settings/account" className="text-sm text-gray-300 hover:text-white">
              {user.displayName}
            </Link>
            <Button size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-sm text-gray-300 hover:text-white">
              Log in
            </Link>
            <Button size="sm" asChild>
              <Link href="/register">Sign up</Link>
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
