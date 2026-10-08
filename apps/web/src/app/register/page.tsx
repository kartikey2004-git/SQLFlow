"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuth();

  useEffect(() => {
    if (!authLoading && user) router.replace("/assignments");
  }, [authLoading, user, router]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const invalid = error !== null;
  const passwordError =
    password.length > 0 && password.length < MIN_PASSWORD_LENGTH
      ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
      : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordError) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: signUpError } = await authClient.signUp.email({
        email,
        password,
        name: displayName,
      });
      if (signUpError) {
        setError(signUpError.message ?? "Could not create your account. Try a different email.");
        return;
      }
      await refresh();
      router.push("/assignments");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocial = async (provider: "google" | "github") => {
    setError(null);
    try {
      await authClient.signIn.social({ provider, callbackURL: `${window.location.origin}/assignments` });
    } catch {
      setError(`Could not start ${provider === "google" ? "Google" : "GitHub"} sign-up. Try again.`);
    }
  };

  if (!authLoading && user) return null;

  return (
    <AuthShell mode="register" title="Create your account" subtitle="Start practising SQL against real databases.">
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} aria-busy={submitting}>
        {error && <AuthError message={error} />}

        <AuthField id="displayName" label="Display name">
          <Input
            id="displayName"
            type="text"
            name="name"
            autoComplete="name"
            autoFocus
            required
            disabled={submitting}
            aria-invalid={invalid || undefined}
            placeholder="How should we greet you?"
            className="h-10"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </AuthField>

        <AuthField id="email" label="Email">
          <Input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            required
            disabled={submitting}
            aria-invalid={invalid || undefined}
            placeholder="you@example.com"
            className="h-10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </AuthField>

        <AuthField
          id="password"
          label="Password"
          hint={`Min. ${MIN_PASSWORD_LENGTH} characters`}
          error={passwordError}
        >
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            disabled={submitting}
            aria-invalid={passwordError || invalid ? true : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </AuthField>

        <Button type="submit" size="lg" disabled={submitting || Boolean(passwordError)} className="h-10 w-full">
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? "Creating account..." : "Create account"}
        </Button>

        <p role="status" aria-live="polite" className="sr-only">
          {submitting ? "Creating your account, please wait." : ""}
        </p>

        <AuthDivider />

        <SocialButtons disabled={submitting} onSelect={handleSocial} />
      </form>
    </AuthShell>
  );
}
