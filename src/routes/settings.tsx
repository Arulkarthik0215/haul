import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail, Bell, RefreshCw, Shield, LogOut, Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/use-theme";
import { useSignOut, useAuthSession } from "@/hooks/use-auth";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, getProviderToken } from "@/lib/supabase";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · OrderHub" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  const navigate = useNavigate();
  const { mutate: signOut } = useSignOut();
  const { data: session } = useAuthSession();

  const handleSignOut = () => {
    signOut(undefined, {
      onSuccess: () => navigate({ to: "/login" })
    });
  };

  const handleSync = async () => {
    if (!supabase) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const providerToken = getProviderToken();

      if (!providerToken) {
        setSyncResult("Google token expired. Please log out and sign in again to re-authorize.");
        return;
      }

      // Force a session refresh to get a valid access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        setSyncResult(`Session error: ${sessionError?.message || 'No active session. Please log in again.'}`);
        return;
      }

      let nextPageToken: string | undefined = undefined;
      let totalProcessed = 0;
      let totalOrders = 0;
      let pagesFetched = 0;
      const MAX_PAGES = 5; // Safety limit: process up to 100 emails per sync click

      do {
        setSyncResult(`Syncing... Processed ${totalProcessed} emails so far.`);
        
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-gmail`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ 
              provider_token: providerToken,
              page_token: nextPageToken 
            }),
          }
        );

        const result = await res.json();

        if (!res.ok || result.error) {
          setSyncResult(`Sync error: ${result.error || result.message || res.statusText}`);
          break; // Stop on error
        }

        totalProcessed += result.processed || 0;
        totalOrders += result.orders?.length || 0;
        nextPageToken = result.nextPageToken;
        pagesFetched++;

        // Update UI immediately with findings
        queryClient.invalidateQueries({ queryKey: ["orders"] });

      } while (nextPageToken && pagesFetched < MAX_PAGES);

      if (pagesFetched >= MAX_PAGES && nextPageToken) {
        setSyncResult(`Synced! Processed ${totalProcessed} emails, found ${totalOrders} orders. Click Sync again to fetch more older history.`);
      } else {
        setSyncResult(`Sync complete! Processed ${totalProcessed} emails, found ${totalOrders} orders.`);
      }

    } catch (e: any) {
      console.error(e);
      setSyncResult(`Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your account and preferences.</p>

      <Section title="Account">
        <Row icon={Mail} label="Connected Gmail" value={session?.user?.email || "Demo User"} />
      </Section>

      <Section title="Appearance">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm font-medium">Theme</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setTheme("dark")}
              className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-sm ${
                theme === "dark" ? "border-foreground bg-accent" : "hover:border-foreground/30"
              }`}
            >
              <Moon className="h-4 w-4" /> Dark
            </button>
            <button
              onClick={() => setTheme("light")}
              className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-sm ${
                theme === "light" ? "border-foreground bg-accent" : "hover:border-foreground/30"
              }`}
            >
              <Sun className="h-4 w-4" /> Light
            </button>
          </div>
        </div>
      </Section>

      <Section title="Preferences">
        <ToggleRow
          icon={Bell}
          label="Notifications"
          description="Get notified for shipment and delivery updates"
          checked={notifications}
          onChange={setNotifications}
        />
        <ToggleRow
          icon={RefreshCw}
          label="Automatic sync"
          description="Sync new emails every 15 minutes"
          checked={autoSync}
          onChange={setAutoSync}
        />
        <div className="mt-4 flex justify-end">
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          {syncResult && (
            <p className={`mt-2 text-xs ${syncResult.startsWith('Synced') ? 'text-green-400' : 'text-yellow-400'}`}>
              {syncResult}
            </p>
          )}
        </div>
      </Section>

      <Section title="Privacy">
        <div className="rounded-xl border bg-card p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Shield className="h-4 w-4 text-muted-foreground" /> Your data stays yours
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            OrderHub only reads order-related emails. Nothing is shared, sold, or used to train
            models. You can revoke Gmail access anytime.
          </p>
        </div>
      </Section>

      <button
        onClick={handleSignOut}
        className="mt-8 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:border-destructive/40 hover:text-destructive"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-sm text-muted-foreground">{value}</span>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: typeof Mail;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
