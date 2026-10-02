"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@sql-learn/ui/lib/utils";

const TABS = [
  { href: "/settings/account", label: "Account" },
  { href: "/settings/connections", label: "Connections" },
  { href: "/settings/sessions", label: "Sessions" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto min-h-[calc(100vh-65px)] max-w-2xl bg-neutral-50 px-8 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Settings</h1>
      <nav className="mb-8 flex gap-1 border-b border-neutral-200">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm",
              pathname === tab.href
                ? "border-blue-600 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-700",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="rounded-lg border border-neutral-200 bg-white p-8">
        {children}
      </div>
    </div>
  );
}
