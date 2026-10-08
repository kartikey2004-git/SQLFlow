"use client";

import { useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Github, Layers } from "lucide-react";
import { Input } from "@sql-learn/ui/components/input";
import { cn } from "@sql-learn/ui/lib/utils";

const tabs = [
  { mode: "login", href: "/login", label: "Log in" },
  { mode: "register", href: "/register", label: "Sign up" },
] as const;

const greenTheme = {
  "--primary": "#059669",
  "--primary-foreground": "#ffffff",
  "--ring": "#10b981",
} as CSSProperties;

const highlights = [
  "A private Postgres sandbox for every practice session",
  "Graded feedback in under two seconds",
  "Row-by-row diffs that explain what went wrong",
];

function ProductPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-emerald-700 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(16,185,129,0.22)_1px,transparent_1px)] [background-size:22px_22px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-24 size-96 rounded-full bg-emerald-500/20 blur-3xl"
      />

      <div className="relative flex items-center gap-3">
       
        <span className="text-sm font-medium tracking-tight">SqlFlow</span>
      </div>

      <div className="relative flex flex-col gap-8">
        <div className="space-y-4">
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            Master SQL by writing real queries.
          </h2>
          <p className="max-w-md text-sm leading-6 text-emerald-100/70">
            Practise against live databases with graded challenges and instant feedback. No setup, no guessing.
          </p>
        </div>

        <ul className="flex flex-col gap-3 border-t border-emerald-500/60 pt-6">
          {highlights.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-emerald-50/90">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative font-mono text-xs text-emerald-200/50">
        Runs in your browser · Real Postgres under the hood
      </p>
    </aside>
  );
}

export function AuthShell({
  mode,
  title,
  subtitle,
  children,
}: {
  mode: (typeof tabs)[number]["mode"];
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div
      style={greenTheme}
      className="grid min-h-screen bg-neutral-50 lg:grid-cols-2"
    >
      <ProductPanel />

      <main className="relative flex items-center justify-center overflow-hidden px-4 py-8 sm:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#d4d4d4_1px,transparent_1px)] opacity-50 [background-size:20px_20px]"
        />

        <div className="relative w-full max-w-[400px]">
          <div className="mb-6 space-y-1.5 text-center lg:text-left">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
            <p className="text-sm text-neutral-500">{subtitle}</p>
          </div>

          <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-16px_rgba(0,0,0,0.14)] sm:p-8">
            <nav aria-label="Account" className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1">
              {tabs.map((tab) => (
                <Link
                  key={tab.mode}
                  href={tab.href}
                  aria-current={mode === tab.mode ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors",
                    mode === tab.mode
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-900",
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>

            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function AuthField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-neutral-700">
          {label}
        </label>
        {hint && !error ? <span className="text-xs text-neutral-400">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordInput({ id, className, ...props }: ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        className={cn("h-10 pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={props.disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-50"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
      <span className="h-px flex-1 bg-neutral-200" />
      or continue with
      <span className="h-px flex-1 bg-neutral-200" />
    </div>
  );
}

export function SocialButtons({
  disabled,
  onSelect,
}: {
  disabled?: boolean;
  onSelect: (provider: "google" | "github") => void;
}) {
  const buttonClass =
    "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white text-sm font-medium text-neutral-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="grid grid-cols-2 gap-3">
      <button type="button" disabled={disabled} onClick={() => onSelect("google")} className={buttonClass}>
        Google
      </button>
      <button type="button" disabled={disabled} onClick={() => onSelect("github")} className={buttonClass}>
        <Github className="size-4" />
        GitHub
      </button>
    </div>
  );
}
