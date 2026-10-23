import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  type ErrorComponentProps,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import appCss from "../styles.css?url";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { MobileNav } from "@/components/mobile-nav";
import { SyncProvider } from "@/components/sync-provider";
import { themeBootScript } from "@/hooks/use-theme";
import { useAuthSession } from "@/hooks/use-auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold tracking-[0.3em] text-muted-foreground">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-md bg-surface-2 px-5 text-sm font-semibold text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Haul — All your orders in one place" },
      {
        name: "description",
        content:
          "Haul reads your order emails and keeps every purchase — Amazon, Flipkart, Swiggy, Myntra and more — in one tidy, private list.",
      },
      { property: "og:title", content: "Haul — All your orders in one place" },
      {
        property: "og:description",
        content: "A unified dashboard for every online purchase — powered by your inbox.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      // No favicon: an empty icon stops the browser requesting /favicon.ico
      { rel: "icon", href: "data:," },
    ],
    scripts: [
      {
        children: themeBootScript,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AppShell() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const router = useRouter();
  const { data: session, isLoading } = useAuthSession();
  // The landing page is public; everything else is the signed-in app
  const isPublic = pathname === "/" || pathname === "/login";

  useEffect(() => {
    if (!isPublic && !isLoading && !session) {
      // Drop any stale saved session first, or the landing page would send us straight back here
      try {
        Object.keys(localStorage)
          .filter((k) => /^sb-.+-auth-token$/.test(k))
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        // storage unavailable — nothing to clear
      }
      router.navigate({ to: "/", replace: true });
    }
  }, [isPublic, isLoading, session, router]);

  if (isPublic) return <Outlet />;

  if (isLoading || !session) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        role="status"
        aria-label="Loading"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SyncProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 pb-24 md:pb-12">
            <Outlet />
          </main>
        </div>
        <MobileNav />
      </div>
    </SyncProvider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
