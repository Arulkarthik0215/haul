import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { supabase, getProviderToken } from "@/lib/supabase";
import { relativePhrase } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10; // Emails per function call; the function reads them in groups of 5 per AI request
const MAX_PAGES = 10; // Safety limit: process up to ~100 emails per sync
const MAX_RETRIES_PER_PAGE = 3;

// Automatic sync: when the app is open and the last sync is older than this, sync quietly
const AUTO_SYNC_AFTER_MS = 30 * 60 * 1000;
const AUTO_SYNC_CHECK_EVERY_MS = 5 * 60 * 1000;
// New emails are at the top of the inbox, so a background sync only needs the first few pages
const AUTO_SYNC_MAX_PAGES = 3;
const AUTO_SYNC_KEY = "haul-auto-sync";

function autoSyncEnabled() {
  try {
    return localStorage.getItem(AUTO_SYNC_KEY) !== "off";
  } catch {
    return true;
  }
}

/** The per-device "sync automatically" preference (stored in this browser). */
export function useAutoSyncSetting() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => setEnabled(autoSyncEnabled()), []);
  const update = (next: boolean) => {
    try {
      localStorage.setItem(AUTO_SYNC_KEY, next ? "on" : "off");
    } catch {
      // storage unavailable — the choice just won't persist
    }
    setEnabled(next);
  };
  return [enabled, update] as const;
}

interface SyncResponse {
  success?: boolean;
  processed?: number;
  orders?: unknown[];
  /** Emails that updated an order already saved (e.g. "delivered" after "order placed"). */
  updated_orders?: number;
  errors?: string[];
  deferred?: number;
  skip_reasons?: {
    already_synced?: number;
    previously_skipped?: number;
    not_an_order?: number;
    no_text?: number;
  };
  not_order_subjects?: string[];
  deferred_reason?: string | null;
  retry_after?: number;
  nextPageToken?: string;
  error?: string;
  message?: string;
  reauth?: boolean;
}

type Phase = "idle" | "syncing" | "done" | "error";

interface SyncRun {
  phase: Phase;
  pages: number;
  processed: number;
  ordersFound: number;
  ordersUpdated: number;
  failed: number;
  deferred: number;
  alreadySynced: number;
  notOrders: number;
  notOrderSubjects: string[];
  deferredReason?: string;
  waitingUntil?: number;
  firstError?: string;
  moreAvailable: boolean;
  errorMessage?: string;
  needsSignIn: boolean;
}

const initialRun: SyncRun = {
  phase: "idle",
  pages: 0,
  processed: 0,
  ordersFound: 0,
  ordersUpdated: 0,
  failed: 0,
  deferred: 0,
  alreadySynced: 0,
  notOrders: 0,
  notOrderSubjects: [],
  moreAvailable: false,
  needsSignIn: false,
};

interface SyncContextValue {
  run: SyncRun;
  syncing: boolean;
  /** A quiet automatic sync is running (no dialog). */
  backgroundSyncing: boolean;
  startSync: () => void;
  /** Stop a manual sync; orders saved so far stay in the list. */
  cancelSync: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used inside <SyncProvider>");
  return ctx;
}

/** When the inbox was last synced, from gmail_sync_state (null if never synced). */
export function useSyncState() {
  return useQuery({
    queryKey: ["sync-state"],
    enabled: !!supabase,
    queryFn: async () => {
      const { data } = await supabase!
        .from("gmail_sync_state")
        .select("last_synced_at, total_emails_processed")
        .maybeSingle();
      return data as {
        last_synced_at: string | null;
        total_emails_processed: number | null;
      } | null;
    },
  });
}

/** One call to the sync-gmail function: reads the next page of matching emails. */
async function requestSyncPage(
  accessToken: string,
  pageToken: string | undefined,
  signal?: AbortSignal,
) {
  const res: Response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-gmail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        // Optional fast path — the edge function falls back to the stored Google refresh token
        provider_token: getProviderToken(),
        page_token: pageToken,
        page_size: PAGE_SIZE,
      }),
      signal,
    },
  );
  const result: SyncResponse = await res.json().catch(() => ({ error: res.statusText }));
  return { ok: res.ok && !result.error, status: res.status, result };
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [run, setRun] = useState<SyncRun>(initialRun);
  const queryClient = useQueryClient();
  const running = useRef(false);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  // A manual sync requested while a background one runs starts as soon as it finishes
  const manualRequested = useRef(false);
  // Lets the dialog's X stop a manual sync between (or during) batches
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef(run);
  runRef.current = run;

  const startSync = useCallback(async () => {
    if (running.current) {
      manualRequested.current = true;
      return;
    }
    running.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    setRun({ ...initialRun, phase: "syncing" });

    const fail = (errorMessage: string, needsSignIn = false) =>
      !signal.aborted && setRun((r) => ({ ...r, phase: "error", errorMessage, needsSignIn }));

    try {
      if (!supabase) {
        fail("Haul isn't connected to its backend right now. Please try again later.", true);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        fail("You're not signed in. Sign in with Google so Haul can read your order emails.", true);
        return;
      }

      let pageToken: string | undefined;
      let hasMore = true;
      let pages = 0;
      let retries = 0; // retries of the current page after Gemini asked us to slow down
      let savedThisPage = 0;

      while (hasMore && pages < MAX_PAGES) {
        const { ok, status, result } = await requestSyncPage(
          session.access_token,
          pageToken,
          signal,
        );
        if (signal.aborted) return;

        if (!ok) {
          fail(
            result.reauth
              ? `${result.error} Please sign in again to re-authorize Gmail.`
              : result.error || result.message || `Request failed (${status})`,
            !!result.reauth,
          );
          return;
        }

        const found = result.orders?.length || 0;
        const common = (r: SyncRun): SyncRun => ({
          ...r,
          ordersFound: r.ordersFound + found,
          ordersUpdated: r.ordersUpdated + (result.updated_orders || 0),
          failed: r.failed + (result.errors?.length || 0),
          notOrders: r.notOrders + (result.skip_reasons?.not_an_order || 0),
          notOrderSubjects: [...r.notOrderSubjects, ...(result.not_order_subjects ?? [])].slice(
            0,
            12,
          ),
          firstError: r.firstError ?? result.errors?.[0],
          deferredReason: result.deferred_reason ?? r.deferredReason,
        });
        queryClient.invalidateQueries({ queryKey: ["orders"] });

        // Gemini rate-limited part of this batch: wait as asked, then redo the same page
        if ((result.deferred || 0) > 0 && retries < MAX_RETRIES_PER_PAGE) {
          retries++;
          savedThisPage += found;
          const waitMs = Math.min(Math.max(result.retry_after || 15, 5), 60) * 1000;
          setRun((r) => ({ ...common(r), waitingUntil: Date.now() + waitMs }));
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, waitMs);
            signal.addEventListener("abort", () => {
              clearTimeout(timer);
              resolve();
            });
          });
          if (signal.aborted) return;
          setRun((r) => ({ ...r, waitingUntil: undefined }));
          continue;
        }

        pages++;
        pageToken = result.nextPageToken;
        hasMore = !!pageToken;
        const alreadySynced = Math.max(
          0,
          (result.skip_reasons?.already_synced || 0) - savedThisPage,
        );
        retries = 0;
        savedThisPage = 0;
        setRun((r) => ({
          ...common(r),
          pages,
          processed: r.processed + (result.processed || 0),
          deferred: r.deferred + (result.deferred || 0),
          alreadySynced: r.alreadySynced + alreadySynced,
        }));
      }

      setRun((r) => ({ ...r, phase: "done", moreAvailable: hasMore }));
    } catch (e) {
      if (signal.aborted) return; // cancelled — the aborted request isn't an error
      console.error(e);
      fail(e instanceof Error ? e.message : "Something went wrong while syncing.");
    } finally {
      running.current = false;
      abortRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["sync-state"] });
    }
  }, [queryClient]);

  const cancelSync = useCallback(() => {
    if (!abortRef.current) return;
    abortRef.current.abort();
    const found = runRef.current.ordersFound;
    setRun(initialRun);
    toast("Sync stopped", {
      description:
        found > 0
          ? `${found} order${found === 1 ? " was" : "s were"} saved. Sync again to pick up the rest.`
          : "Sync again any time to pick up where it left off.",
    });
    // The batch that was in flight may still finish saving on the server — refresh once more
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["sync-state"] });
    }, 20_000);
  }, [queryClient]);

  /**
   * Quiet sync: newest emails only, no dialog. Stops at the first page with nothing new, and on
   * any error or AI rate limit (the next automatic or manual sync simply picks up from there).
   */
  const backgroundSync = useCallback(async () => {
    if (running.current || !supabase) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    running.current = true;
    setBackgroundSyncing(true);
    let found = 0;
    try {
      let pageToken: string | undefined;
      for (let page = 0; page < AUTO_SYNC_MAX_PAGES; page++) {
        const { ok, result } = await requestSyncPage(session.access_token, pageToken);
        if (!ok) {
          console.warn("Automatic sync stopped:", result.error || result.message);
          break;
        }
        const saved = result.orders?.length || 0;
        found += saved;
        if (saved > 0) queryClient.invalidateQueries({ queryKey: ["orders"] });

        const reasons = result.skip_reasons ?? {};
        const newEmails =
          (result.processed || 0) -
          (reasons.already_synced || 0) -
          (reasons.previously_skipped || 0);
        if ((result.deferred || 0) > 0 || newEmails <= 0 || !result.nextPageToken) break;
        pageToken = result.nextPageToken;
      }
      if (found > 0) {
        toast(`${found} new order${found === 1 ? "" : "s"} found`, {
          description: "Your inbox was synced automatically.",
        });
      }
    } catch (e) {
      console.warn("Automatic sync failed:", e);
    } finally {
      running.current = false;
      setBackgroundSyncing(false);
      queryClient.invalidateQueries({ queryKey: ["sync-state"] });
      if (manualRequested.current) {
        manualRequested.current = false;
        startSync();
      }
    }
  }, [queryClient, startSync]);

  // Decide when to sync automatically: on open, when the tab becomes visible again, and every few
  // minutes while it stays open — only if the last sync is old enough. A first-ever sync stays
  // manual, since it reads the whole history and is worth watching.
  const { data: syncState, isSuccess: syncStateLoaded } = useSyncState();
  const lastSyncedAt = useRef<string | null>(null);
  lastSyncedAt.current = syncState?.last_synced_at ?? null;

  useEffect(() => {
    if (!syncStateLoaded) return;
    const maybeAutoSync = () => {
      if (!autoSyncEnabled() || document.visibilityState !== "visible") return;
      const last = lastSyncedAt.current;
      if (!last || Date.now() - new Date(last).getTime() < AUTO_SYNC_AFTER_MS) return;
      backgroundSync();
    };
    maybeAutoSync();
    document.addEventListener("visibilitychange", maybeAutoSync);
    const timer = setInterval(maybeAutoSync, AUTO_SYNC_CHECK_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", maybeAutoSync);
      clearInterval(timer);
    };
  }, [syncStateLoaded, backgroundSync]);

  return (
    <SyncContext.Provider
      value={{ run, syncing: run.phase === "syncing", backgroundSyncing, startSync, cancelSync }}
    >
      {children}
      <SyncDialog
        run={run}
        onClose={() => setRun(initialRun)}
        onCancel={cancelSync}
        onRetry={startSync}
      />
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              "!rounded-lg !border-0 !bg-popover !text-popover-foreground !shadow-[var(--shadow-soft)]",
            description: "!text-muted-foreground",
          },
        }}
      />
    </SyncContext.Provider>
  );
}

function SyncDialog({
  run,
  onClose,
  onCancel,
  onRetry,
}: {
  run: SyncRun;
  onClose: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const syncing = run.phase === "syncing";
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second while we're waiting out a rate limit, so the countdown moves
  useEffect(() => {
    if (!run.waitingUntil) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [run.waitingUntil]);

  // Leaving the page mid-sync would cut the batch loop short — ask first
  useEffect(() => {
    if (!syncing) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [syncing]);

  const progress = syncing ? Math.min(95, Math.max(8, (run.pages / MAX_PAGES) * 100)) : 100;

  return (
    <DialogPrimitive.Root
      open={run.phase !== "idle"}
      onOpenChange={(open) => !open && (syncing ? onCancel() : onClose())}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0e0f11]/45 backdrop-blur-[6px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => syncing && e.preventDefault()}
          onInteractOutside={(e) => syncing && e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-popover px-8 pb-8 pt-9 text-center text-popover-foreground shadow-[var(--shadow-glow)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <DialogPrimitive.Close
            aria-label={syncing ? "Stop syncing" : "Close"}
            title={syncing ? "Stop syncing — orders found so far are kept" : "Close"}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          {syncing && (
            <>
              <SyncLoader />
              <DialogPrimitive.Title className="mt-6 text-xl font-semibold">
                Syncing your inbox
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-muted-foreground">
                Reading your order emails. You can stop any time with the × — orders found so far
                are kept.
              </DialogPrimitive.Description>
              <ProgressBar value={run.pages === 0 ? null : progress} />
              <p className="mt-3 text-xs tabular-nums text-muted-foreground" aria-live="polite">
                {run.waitingUntil
                  ? `The AI service asked us to slow down — continuing in ${Math.max(0, Math.ceil((run.waitingUntil - now) / 1000))}s`
                  : run.pages === 0
                    ? "Connecting to Gmail…"
                    : `${run.processed} emails checked · ${run.ordersFound} order${run.ordersFound === 1 ? "" : "s"} found`}
              </p>
            </>
          )}

          {run.phase === "done" && (
            <>
              <StatusIcon tone="ok" />
              <DialogPrimitive.Title className="mt-6 text-xl font-semibold">
                {run.ordersFound > 0
                  ? `${run.ordersFound} new order${run.ordersFound === 1 ? "" : "s"} found`
                  : run.notOrders > 0 || run.failed > 0
                    ? "No new orders found"
                    : "You're all caught up"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-muted-foreground">
                Checked {run.processed} email{run.processed === 1 ? "" : "s"}
                {run.alreadySynced > 0 && ` (${run.alreadySynced} already in your list)`}.
                {run.ordersUpdated > 0 &&
                  ` ${run.ordersUpdated} update${run.ordersUpdated === 1 ? "" : "s"} (like shipped or delivered) added to orders you already had.`}
                {run.moreAvailable && " Sync again to go further back in your inbox."}
              </DialogPrimitive.Description>
              {(run.deferred > 0 || run.failed > 0 || run.notOrders > 0) && (
                <div className="mt-5 space-y-1 rounded-lg bg-surface px-4 py-3 text-left text-xs text-muted-foreground">
                  {run.deferred > 0 && (
                    <p>
                      <span className="font-medium text-foreground">{run.deferred} postponed</span>{" "}
                      — the AI service kept asking us to slow down. They'll be picked up next sync.
                      {run.deferredReason && (
                        <span className="mt-1 block break-words opacity-80">
                          {run.deferredReason}
                        </span>
                      )}
                    </p>
                  )}
                  {run.failed > 0 && (
                    <p className="break-words">
                      <span className="font-medium text-foreground">
                        {run.failed} couldn't be read
                      </span>
                      {run.firstError && <> — {run.firstError.replace(/^[0-9a-f]+: /, "")}</>}
                    </p>
                  )}
                  {run.notOrders > 0 && (
                    <details>
                      <summary className="cursor-pointer">
                        <span className="font-medium text-foreground">
                          {run.notOrders} weren't orders
                        </span>{" "}
                        — ads, reminders and similar. Show which
                      </summary>
                      <ul className="mt-2 list-disc space-y-1 pl-4">
                        {run.notOrderSubjects.map((subject, i) => (
                          <li key={i} className="break-words">
                            {subject || "(no subject)"}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
              <div className="mt-7 grid grid-cols-2 gap-2">
                <QuietButton onClick={onClose}>Close</QuietButton>
                <PrimaryButton
                  onClick={() => {
                    onClose();
                    navigate({ to: "/orders" });
                  }}
                >
                  View orders
                </PrimaryButton>
              </div>
            </>
          )}

          {run.phase === "error" && (
            <>
              <StatusIcon tone="bad" />
              <DialogPrimitive.Title className="mt-6 text-xl font-semibold">
                Sync didn't finish
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mx-auto mt-2 max-w-sm break-words text-[15px] leading-relaxed text-muted-foreground">
                {run.errorMessage}
              </DialogPrimitive.Description>
              {run.processed > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {run.ordersFound} order{run.ordersFound === 1 ? "" : "s"} saved before it stopped.
                </p>
              )}
              <div className="mt-7 grid grid-cols-2 gap-2">
                <QuietButton onClick={onClose}>Close</QuietButton>
                {run.needsSignIn ? (
                  <PrimaryButton
                    onClick={() => {
                      onClose();
                      navigate({ to: "/" });
                    }}
                  >
                    Sign in
                  </PrimaryButton>
                ) : (
                  <PrimaryButton onClick={onRetry}>Try again</PrimaryButton>
                )}
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SyncLoader() {
  return (
    <svg
      viewBox="0 0 80 80"
      className="mx-auto h-[76px] w-[76px] text-muted-foreground"
      aria-hidden
    >
      <circle
        className="animate-sync-spin"
        cx="40"
        cy="40"
        r="34"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="5 7"
      />
      <circle className="animate-sync-breathe fill-foreground/75" cx="40" cy="40" r="7" />
    </svg>
  );
}

function ProgressBar({ value }: { value: number | null }) {
  return (
    <div
      className="mt-7 h-2 w-full overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      aria-label="Sync progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
    >
      {value === null ? (
        <div className="animate-sync-indeterminate h-full w-2/5 rounded-full bg-muted-foreground/70" />
      ) : (
        <div
          className="h-full rounded-full bg-muted-foreground/70 transition-[width] duration-700 ease-out"
          style={{ width: `${value}%` }}
        />
      )}
    </div>
  );
}

function StatusIcon({ tone }: { tone: "ok" | "bad" }) {
  const Icon = tone === "ok" ? Check : AlertTriangle;
  return (
    <div
      className={cn(
        "mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-full",
        tone === "ok" ? "bg-ok/12 text-ok" : "bg-bad/12 text-bad",
      )}
    >
      <Icon className="h-8 w-8" strokeWidth={2.2} />
    </div>
  );
}

export function PrimaryButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-[background-color,color,transform] duration-200 hover:bg-foreground hover:text-background active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function QuietButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-surface-2 px-5 text-sm font-semibold text-foreground transition-[background-color,color,transform] duration-200 hover:bg-foreground hover:text-background active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

/** The one Sync entry point used across the app. */
export function SyncButton({
  variant = "primary",
  className,
}: {
  variant?: "primary" | "quiet" | "icon";
  className?: string;
}) {
  const { syncing, backgroundSyncing, startSync } = useSync();
  const busy = syncing || backgroundSyncing;
  const icon = <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />;

  if (variant === "icon") {
    return (
      <button
        onClick={startSync}
        disabled={syncing}
        aria-label="Sync inbox"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-foreground hover:text-background disabled:opacity-60",
          className,
        )}
      >
        {icon}
      </button>
    );
  }

  const Btn = variant === "primary" ? PrimaryButton : QuietButton;
  return (
    <Btn
      onClick={startSync}
      disabled={syncing}
      className={className}
      title={backgroundSyncing ? "Checking for new orders — click for a full sync" : undefined}
    >
      {icon}
      {busy ? "Syncing…" : "Sync inbox"}
    </Btn>
  );
}

/** "Synced 5m ago" style label for the last sync. */
export function LastSynced({ className }: { className?: string }) {
  const { data } = useSyncState();
  const at = data?.last_synced_at;
  if (!at) return <span className={className}>Not synced yet</span>;
  return <span className={className}>Last synced {relativePhrase(at)}</span>;
}
