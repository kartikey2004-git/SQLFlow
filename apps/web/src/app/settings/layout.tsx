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
    <div className="mx-auto min-h-[calc(100vh-65px)] max-w-2xl bg-surface-dark px-8 py-10 text-gray-200">
      <h1 className="mb-6 text-2xl font-semibold text-white">Settings</h1>
      <nav className="mb-8 flex gap-1 border-b border-surface-dark-border">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm",
              pathname === tab.href
                ? "border-blue-400 text-white"
                : "border-transparent text-gray-400 hover:text-gray-200",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
