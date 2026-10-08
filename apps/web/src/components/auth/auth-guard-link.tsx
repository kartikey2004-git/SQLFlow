"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useAuth } from "@/context/AuthContext";

type AuthGuardLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export function AuthGuardLink({ href, ...props }: AuthGuardLinkProps) {
  const { user } = useAuth();
  const target = user ? href : `/login?next=${encodeURIComponent(href)}`;

  return <Link href={target} {...props} />;
}
