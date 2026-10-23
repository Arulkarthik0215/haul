import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";

// Where people can reach the developer about their data (also shown on Google's consent screen)
export const CONTACT_EMAIL = "iarulkarthik15@gmail.com";

/** Shared shell for the public Privacy and Terms pages. */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-3xl items-center justify-between px-5 md:px-10">
          <Brand to="/" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-10 md:pt-16">
        <p className="text-sm text-muted-foreground">Last updated {updated}</p>
        <h1 className="mt-3 text-[38px] font-semibold leading-tight tracking-[-0.03em] md:text-[46px]">
          {title}
        </h1>
        <div className="mt-6 text-[17px] leading-relaxed text-muted-foreground">{intro}</div>
        <div className="mt-12 space-y-12">{children}</div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground md:px-10">
          <span>© {new Date().getFullYear()} Haul</span>
          <nav className="flex gap-6" aria-label="Legal">
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-4 text-[16px] leading-relaxed text-foreground/85 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
