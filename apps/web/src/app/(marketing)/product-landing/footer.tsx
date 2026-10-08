import { footer } from "../data";
import { AuthGuardLink } from "@/components/auth/auth-guard-link";
import { HashLink } from "./hash-link";
import { Container, Icon } from "./primitives";

export function MarketingFooter() {
  return (
    <footer className="relative overflow-hidden pb-10 pt-20 md:pt-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-24 select-none overflow-hidden sm:block md:h-32 lg:h-40"
      >
        <span
          className="absolute inset-x-0 bottom-[-0.3em] text-center text-[16rem] font-bold leading-none tracking-tight text-transparent md:text-[20rem]"
          style={{ WebkitTextStroke: "1px rgba(255,255,255,0.05)" }}
        >
          {footer.brand.name}
        </span>
      </div>

      <Container className="relative flex flex-col gap-14">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          <div className="flex max-w-sm flex-col gap-4">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
              {footer.brand.name}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {footer.brand.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-10 sm:gap-x-20">
            {footer.columns.map((column) => (
              <div key={column.title} className="flex flex-col gap-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {column.title}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {column.links.map((link) => {
                    const href = link.href === "#waitlist" ? "/assignments" : link.href;

                    return (
                      <li key={link.label}>
                        {href.startsWith("#") ? (
                          <HashLink
                            href={href}
                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {link.label}
                          </HashLink>
                        ) : (
                          <AuthGuardLink
                            href={href}
                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {link.label}
                          </AuthGuardLink>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{footer.bottom.copyright}</p>
          {footer.bottom.links.length > 0 ? (
            <div className="flex items-center gap-5">
              {footer.bottom.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </Container>
    </footer>
  );
}
