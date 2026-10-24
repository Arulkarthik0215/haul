import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ExternalLink, LogOut, Moon, Sun } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/hooks/use-theme";
import { useSignOut } from "@/hooks/use-auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import {
  LastSynced,
  SyncButton,
  useAutoSyncSetting,
  useSyncState,
} from "@/components/sync-provider";
import { Switch } from "@/components/ui/switch";
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
          <AutoSyncToggle />
          <SkippedEmails />
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
            <li>
              Email text is read by AI services only to find order details. Your data is never sold
              or used for ads.
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-primary hover:underline"
            >
              Manage Google access <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link to="/privacy" className="text-primary hover:underline">
              Privacy policy
            </Link>
            <Link to="/terms" className="text-primary hover:underline">
              Terms
            </Link>
          </div>
          <DeleteMyData />
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

/** Emails judged "not an order" are skipped on later syncs; this lets the user have them re-read. */
function SkippedEmails() {
  const queryClient = useQueryClient();
  const [cleared, setCleared] = useState(false);
  const { data: count = 0 } = useQuery({
    queryKey: ["skipped-emails-count"],
    enabled: !!supabase,
    queryFn: async () => {
      const { count } = await supabase!
        .from("skipped_emails")
        .select("email_message_id", { count: "exact", head: true })
        // "merged" emails were updates to an order already saved, not judged non-orders
        .neq("reason", "merged");
      return count ?? 0;
    },
  });
  const recheck = useMutation({
    mutationFn: async () => {
      const { data } = await supabase!.auth.getUser();
      const { error } = await supabase!
        .from("skipped_emails")
        .delete()
        .eq("user_id", data.user!.id)
        .neq("reason", "merged");
      if (error) throw error;
    },
    onSuccess: () => {
      setCleared(true);
      queryClient.invalidateQueries({ queryKey: ["skipped-emails-count"] });
    },
  });

  if (count === 0 && !cleared) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md bg-background px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        {cleared
          ? "Done — the next sync will read those emails again."
          : `${count.toLocaleString("en-IN")} emails were judged not to be orders and are skipped on future syncs.`}
      </span>
      {!cleared && (
        <button
          onClick={() => recheck.mutate()}
          disabled={recheck.isPending}
          className="font-semibold text-primary hover:underline disabled:opacity-50"
        >
          {recheck.isPending ? "Clearing…" : "Re-check them"}
        </button>
      )}
    </div>
  );
}

/** Removes everything Haul stored for this user (orders cascade to products and timeline). */
function DeleteMyData() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const wipe = useMutation({
    mutationFn: async () => {
      const { data } = await supabase!.auth.getUser();
      const userId = data.user!.id;
      for (const table of ["orders", "skipped_emails", "gmail_sync_state"] as const) {
        const { error } = await supabase!.from(table).delete().eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setDone(true);
      setConfirming(false);
      queryClient.invalidateQueries();
    },
  });

  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="text-sm font-semibold">Delete my data</div>
      <p className="mt-1 text-sm text-muted-foreground">
        {done
          ? "Done — your orders, sync history and stored Google token have been deleted."
          : "Removes all your orders, skipped-email records, sync history and the stored Google token. This can't be undone."}
      </p>
      {wipe.error && (
        <p className="mt-2 text-sm text-bad" role="alert">
          Couldn't delete everything: {(wipe.error as Error).message}
        </p>
      )}
      {!done &&
        (confirming ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => wipe.mutate()}
              disabled={wipe.isPending}
              className="inline-flex h-10 items-center rounded-md bg-bad px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {wipe.isPending ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={wipe.isPending}
              className="inline-flex h-10 items-center rounded-md bg-surface-2 px-4 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="mt-3 inline-flex h-10 items-center rounded-md bg-surface-2 px-4 text-sm font-semibold text-bad transition-colors hover:bg-bad hover:text-white"
          >
            Delete my data…
          </button>
        ))}
    </div>
  );
}

function AutoSyncToggle() {
  const [enabled, setEnabled] = useAutoSyncSetting();
  return (
    <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-md bg-background px-4 py-3">
      <span>
        <span className="block text-sm font-medium">Sync automatically</span>
        <span className="block text-sm text-muted-foreground">
          When Haul is open, check for new orders every 30 minutes — quietly, without the sync
          window. Applies to this browser.
        </span>
      </span>
      <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Sync automatically" />
    </label>
  );
}
