import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { isActive, navItems } from "./app-sidebar";

export function MobileNav() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-5">
        {navItems.map((item) => {
          const active = isActive(pathname, item.url);
          return (
            <Link
              key={item.url}
              to={item.url}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5", active && "text-primary")} />
              {item.title}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
