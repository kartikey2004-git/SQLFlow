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
    <nav className="flex items-center justify-between border-b border-neutral-200 bg-white px-8 py-4 text-neutral-900">
      <Link href="/" className="text-[1.1rem] font-semibold text-neutral-900">
        SQL Learn
      </Link>
      <div className="flex items-center gap-4">
        {loading ? null : user ? (
          <>
            <Link href="/settings/account" className="text-sm text-neutral-600 hover:text-neutral-900">
              {user.displayName}
            </Link>
            <Button size="sm" variant="outline" onClick={handleLogout}>
              Log out
            </Button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-sm text-neutral-600 hover:text-neutral-900">
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
