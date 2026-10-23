import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ExternalLink, LogOut, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useSignOut } from "@/hooks/use-auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import { LastSynced, SyncButton, useSyncState } from "@/components/sync-provider";
import { UserChip } from "@/components/user-chip";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Haul" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { mutate: signOut, isPending: signingOut } = useSignOut();
  const { data: syncState } = useSyncState();

  const handleSignOut = () => {
    signOut(undefined, { onSuccess: () => navigate({ to: "/" }) });
  };

  return (
    <PageContainer narrow>
      <PageHeader title="Settings" description="Your account, inbox connection and preferences." />

      <div className="space-y-4">
        <Section title="Account">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <UserChip />
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-surface-2 px-4 text-sm font-semibold transition-colors hover:bg-bad hover:text-white disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" /> {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </Section>

        <Section
          title="Gmail sync"
          description="Haul reads order, shipping and receipt emails — read-only. It never sends, deletes or changes mail."
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <LastSynced className="block text-[15px] font-medium" />
              {syncState?.total_emails_processed ? (
                <span className="text-sm text-muted-foreground">
                  {syncState.total_emails_processed.toLocaleString("en-IN")} emails checked so far
                </span>
              ) : null}
            </div>
            <SyncButton />
          </div>
        </Section>

        <Section title="Appearance">
          <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Theme">
            {(
              [
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
              ] as const
            ).map((t) => (
              <button
                key={t.value}
                role="radio"
                aria-checked={theme === t.value}
                onClick={() => setTheme(t.value)}
                className={cn(
                  "relative flex h-12 items-center justify-center gap-2 overflow-hidden rounded-md text-sm font-semibold transition-colors",
                  theme === t.value
                    ? "bg-surface-2 text-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="h-4 w-4" /> {t.label}
                {theme === t.value && (
                  <span className="absolute inset-x-0 bottom-0 h-[3px] bg-primary" aria-hidden />
                )}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Privacy">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Only the order details are stored — never your full emails.</li>
            <li>Your orders are visible only to you, enforced by the database itself.</li>
            <li>Nothing is shared or sold.</li>
          </ul>
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Manage Google access <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Section>
      </div>
    </PageContainer>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg bg-card p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
