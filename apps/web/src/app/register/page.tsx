"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@sql-learn/ui/components/button";
import { Input } from "@sql-learn/ui/components/input";
import { Label } from "@sql-learn/ui/components/label";
import { Alert, AlertDescription } from "@sql-learn/ui/components/alert";

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: signUpError } = await authClient.signUp.email({
        email,
        password,
        name: displayName,
      });
      if (signUpError) {
        setError(signUpError.message ?? "Failed to register");
        return;
      }
      await refresh();
      router.push("/assignments");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocial = async (provider: "google" | "github") => {
    await authClient.signIn.social({ provider, callbackURL: "/assignments" });
  };

  return (
    <div className="flex min-h-[calc(100vh-65px)] items-center justify-center bg-neutral-50 p-8">
      <form
        className="flex w-full max-w-[360px] flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
        onSubmit={handleSubmit}
      >
        <h1 className="mb-2 text-2xl font-semibold text-neutral-900">Create an account</h1>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName" className="text-neutral-700">
            Display name
          </Label>
          <Input
            id="displayName"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? "Creating account..." : "Sign up"}
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
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
