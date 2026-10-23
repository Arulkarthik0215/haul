import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Package, ChartColumn, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { UserChip } from "./user-chip";
import { LastSynced, SyncButton } from "./sync-provider";

export const navItems = [
  { title: "Home", url: "/dashboard", icon: LayoutGrid },
  { title: "Orders", url: "/orders", icon: Package },
  { title: "Insights", url: "/analytics", icon: ChartColumn },
  { title: "Search", url: "/search", icon: Search },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function isActive(pathname: string, url: string) {
  return pathname.startsWith(url);
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar md:flex">
      <div className="px-6 pb-7 pt-6">
        <Brand />
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Main">
        {navItems.map((item) => {
          const active = isActive(pathname, item.url);
          return (
            <Link
              key={item.url}
              to={item.url}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", active && "text-primary")} />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-3 rounded-lg bg-background p-4">
        <div className="text-sm font-semibold">Gmail inbox</div>
        <LastSynced className="mt-0.5 block text-xs text-muted-foreground" />
        <SyncButton className="mt-3 h-10 w-full" />
      </div>

      <div className="px-5 pb-5 pt-2">
        <UserChip />
      </div>
    </aside>
  );
}
