import { Search } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { Brand } from "./brand";
import { SyncButton } from "./sync-provider";

export function AppHeader() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-10">
        <Brand className="mr-1 md:hidden" />
        <form
          role="search"
          className="relative min-w-0 flex-1 md:max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/search", search: { q } });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="global-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search orders, shops, items…"
            aria-label="Search orders"
            className="h-10 w-full rounded-md bg-surface pl-9 pr-14 text-sm outline-none transition-colors placeholder:text-muted-foreground hover:bg-surface-2 focus:bg-surface-2"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            Ctrl K
          </kbd>
        </form>
        <div className="ml-auto flex items-center gap-2">
          <SyncButton variant="icon" className="h-10 w-10 sm:hidden" />
          <SyncButton className="hidden h-10 sm:inline-flex" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
