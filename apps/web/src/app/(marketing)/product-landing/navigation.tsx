"use client";

import { useEffect, useRef, useState, useId } from "react";
import { Button } from "@sql-learn/ui/components/button";
import { cn } from "@sql-learn/ui/lib/utils";
import { navigation } from "../data";
import { AuthGuardLink } from "@/components/auth/auth-guard-link";
import { HashLink } from "./hash-link";
import { Container, Icon } from "./primitives";

export function MarketingNavigation() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const cta = navigation.actions[0];

  useEffect(() => {
    let ticking = false;
    const updateScrolled = () => {
      setScrolled(window.scrollY > 8);
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateScrolled);
    };

    updateScrolled();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;

    firstLinkRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);
  const isPresent = scrolled || open;

  return (
    <header
      ref={headerRef}
      data-site-header=""
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
      )}
    >
      <Container className="flex h-16 items-center justify-between md:h-[72px]">
        <HashLink
          href="#top"
          className="flex items-center text-sm tracking-tight text-foreground"
        >
          <span className="flex size-7 items-center justify-center text-primary">
            <Icon name="layers" className="size-3.5" />
          </span>
          {navigation.logo.text}
        </HashLink>

        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {navigation.links.map((link) => (
            <HashLink
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </HashLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {cta ? (
            <Button
              asChild
              size="sm"
              className="hidden sm:inline-flex rounded-none"
            >
              <AuthGuardLink href="/assignments">
                {cta.label}
              </AuthGuardLink>
            </Button>
          ) : null}

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex size-11 items-center justify-center border border-border text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls={menuId}
          >
            <Icon name={open ? "x" : "menu"} className="size-4" />
          </button>
        </div>
      </Container>

      {open ? (
        <div id={menuId} className="mkt-fade-up border-t border-border lg:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {navigation.links.map((link, index) => (
              <HashLink
                key={link.href}
                ref={index === 0 ? firstLinkRef : undefined}
                href={link.href}
                onClick={closeMenu}
                className="px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-white/[0.03] hover:text-foreground"
              >
                {link.label}
              </HashLink>
            ))}

            {cta ? (
              <Button asChild className="mt-3 w-full rounded-none">
                <AuthGuardLink href="/assignments" onClick={closeMenu}>
                  {cta.label}
                </AuthGuardLink>
              </Button>
            ) : null}
          </Container>
        </div>
      ) : null}
    </header>
  );
}
