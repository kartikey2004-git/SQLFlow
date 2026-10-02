"use client";

import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";

/** Scrolls to an in-page section without letting the browser touch the URL hash. */
function scrollToHash(hash: string) {
  const id = hash.slice(1);

  if (!id || id === "top") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const target = document.getElementById(id);
  if (!target) return;

  const header = document.querySelector("[data-site-header]");
  const offset = (header instanceof HTMLElement ? header.offsetHeight : 0) + 16;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;

  window.scrollTo({ top, behavior: "smooth" });
}

type HashLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** In-page anchor that smooth-scrolls to its target section instead of navigating. */
export const HashLink = forwardRef<HTMLAnchorElement, HashLinkProps>(function HashLink(
  { href, onClick, ...props },
  ref,
) {
  return (
    <a
      ref={ref}
      href={href}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || !href.startsWith("#")) return;
        event.preventDefault();
        scrollToHash(href);
      }}
      {...props}
    />
  );
});
