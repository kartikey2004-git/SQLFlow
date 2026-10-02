"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@sql-learn/ui/components/button";
import { Input } from "@sql-learn/ui/components/input";
import { Label } from "@sql-learn/ui/components/label";
import { Alert, AlertDescription } from "@sql-learn/ui/components/alert";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextPath = searchParams.get("next") || "/assignments";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message ?? "Failed to log in");
        return;
      }
      await refresh();
      router.push(nextPath);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocial = async (provider: "google" | "github") => {
    await authClient.signIn.social({ provider, callbackURL: nextPath });
  };

  return (
    <div className="flex min-h-[calc(100vh-65px)] items-center justify-center bg-neutral-50 p-8">
      <form
        className="flex w-full max-w-[360px] flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
        onSubmit={handleSubmit}
      >
        <h1 className="mb-2 text-2xl font-semibold text-neutral-900">Log in</h1>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-neutral-700">
            Email
          </Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-neutral-700">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? "Logging in..." : "Log in"}
        </Button>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" onClick={() => handleSocial("google")}>
            Continue with Google
          </Button>
          <Button type="button" variant="outline" onClick={() => handleSocial("github")}>
            Continue with GitHub
          </Button>
        </div>
        <p className="text-center text-sm text-neutral-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
