"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/context/AuthContext";
import {
  AuthDivider,
  AuthError,
  AuthField,
  AuthShell,
  PasswordInput,
  SocialButtons,
} from "@/components/auth/auth-ui";
import { Button } from "@sql-learn/ui/components/button";
import { Input } from "@sql-learn/ui/components/input";

const absoluteCallback = (path: string) => {
  const url = new URL(path, window.location.origin);
  return url.origin === window.location.origin ? url.toString() : `${window.location.origin}/assignments`;
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextPath = searchParams.get("next") || "/assignments";
  const invalid = error !== null;

  useEffect(() => {
    if (!authLoading && user) router.replace(nextPath);
  }, [authLoading, user, nextPath, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message ?? "Failed to log in. Check your email and password.");
        return;
      }
      await refresh();
      router.push(nextPath);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocial = async (provider: "google" | "github") => {
    setError(null);
    try {
      await authClient.signIn.social({ provider, callbackURL: absoluteCallback(nextPath) });
    } catch {
      setError(`Could not start ${provider === "google" ? "Google" : "GitHub"} sign-in. Try again.`);
    }
  };

  if (!authLoading && user) return null;

  return (
    <AuthShell mode="login" title="Welcome back" subtitle="Log in to pick up where you left off.">
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} aria-busy={submitting} noValidate={false}>
        {error && <AuthError message={error} />}

        <AuthField id="email" label="Email">
          <Input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            autoFocus
            required
            disabled={submitting}
            aria-invalid={invalid || undefined}
            placeholder="you@example.com"
            className="h-10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </AuthField>

        <AuthField id="password" label="Password">
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            disabled={submitting}
            aria-invalid={invalid || undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </AuthField>

        <Button type="submit" size="lg" disabled={submitting} className="h-10 w-full">
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? "Logging in..." : "Log in"}
        </Button>

        <p role="status" aria-live="polite" className="sr-only">
          {submitting ? "Logging in, please wait." : ""}
        </p>

        <AuthDivider />

        <SocialButtons disabled={submitting} onSelect={handleSocial} />
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
