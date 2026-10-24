import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Check, ChevronDown, Lock, MailCheck, ShieldCheck, X } from "lucide-react";
import { useAuthSession, useSignIn } from "@/hooks/use-auth";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { StatusBadge } from "@/components/status-badge";
import { MerchantAvatar } from "@/components/merchant-avatar";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderStatus, Platform } from "@/types/order";

// Runs in <head> before the page paints: signed-in visitors (a saved Supabase session, or the
// Google sign-in response in the URL) go straight to the app instead of seeing the landing page.
const signedInRedirect = `(function(){try{var l=location;if(/access_token=|[?&]code=/.test(l.hash+l.search)){l.replace('/dashboard'+l.search+l.hash);return}for(var i=0;i<localStorage.length;i++){if(/^sb-.+-auth-token$/.test(localStorage.key(i)||'')){l.replace('/dashboard');return}}}catch(e){}})()`;

export const Route = createFileRoute("/")({
  head: () => ({
    scripts: [{ children: signedInRedirect }],
    meta: [
      { title: "Haul — Every online order, in one list" },
      {
        name: "description",
        content:
          "Haul reads the order emails in your Gmail and turns them into one private list — Amazon, Flipkart, Swiggy, Myntra and more.",
      },
    ],
  }),
  component: Landing,
});

const SHOPS: Platform[] = [
  "Amazon",
  "Flipkart",
  "Swiggy",
  "Zomato",
  "Myntra",
  "Blinkit",
  "Zepto",
  "Ajio",
  "BookMyShow",
  "Uber",
  "IRCTC",
];

const PREVIEW: {
  platform: Platform;
  item: string;
  shop: string;
  when: string;
  status: OrderStatus;
  note?: string;
  amount: number;
}[] = [
  {
    platform: "Swiggy",
    item: "McSpicy Meal + McFlurry",
    shop: "McDonald's",
    when: "Just now",
    status: "delivered",
    amount: 420,
  },
  {
    platform: "Ajio",
    item: "Levi's 511 Slim Fit Jeans",
    shop: "Levi's",
    when: "2h ago",
    status: "shipped",
    note: "Arrives in 2 days",
    amount: 2799,
  },
  {
    platform: "Blinkit",
    item: "Milk, eggs, bread",
    shop: "Blinkit",
    when: "Yesterday",
    status: "delivered",
    amount: 640,
  },
  {
    platform: "Myntra",
    item: "Cotton Oversized T-Shirt",
    shop: "H&M",
    when: "Yesterday",
    status: "packed",
    note: "Arrives in 3 days",
    amount: 1299,
  },
];

function useGoogleSignIn() {
  const { mutate, isPending, error } = useSignIn();
  const signIn = () =>
    mutate(undefined, {
      onSuccess: (res) => {
        if (res.data?.url) window.location.href = res.data.url;
      },
    });
  return { signIn, isPending, error: error ?? null };
}

function Landing() {
  const navigate = useNavigate();
  const { data: session } = useAuthSession();
  const google = useGoogleSignIn();

  // Signed in already (or just back from Google) — go straight to the app
  useEffect(() => {
    if (session) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-8 px-5 md:px-10">
          <Brand to="/" />
          <nav
            className="hidden items-center gap-7 text-[15px] text-muted-foreground md:flex"
            aria-label="Sections"
          >
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#privacy" className="transition-colors hover:text-foreground">
              Privacy
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              Questions
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={google.signIn}
              disabled={google.isPending}
              className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
            >
              Sign in
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <div className="relative isolate">
          <div className="backdrop backdrop-grid" aria-hidden>
            <div className="glow glow-violet -top-[18%] left-[8%] h-[520px] w-[min(720px,90vw)]" />
            <div className="glow glow-coral -right-[6%] top-[12%] h-[460px] w-[min(560px,80vw)]" />
          </div>
          <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-10 md:px-10 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[5fr_6fr] lg:pb-24 lg:pt-4">
            <div className="animate-rise-in">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">
                Your orders, sorted
              </p>
              <h1 className="mt-4 text-[42px] font-semibold leading-[1.04] tracking-[-0.035em] md:text-[56px]">
                Every order you've placed, in one tidy list.
              </h1>
              <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted-foreground">
                Haul reads the order emails already in your Gmail — Amazon, Flipkart, Swiggy, Myntra
                and more — and turns them into one private list you can actually use.
              </p>

              <div className="mt-9">
                <GoogleButton onClick={google.signIn} pending={google.isPending} />
                {google.error && (
                  <p className="mt-3 text-sm text-bad" role="alert">
                    Couldn't open Google sign-in. Please try again.
                  </p>
                )}
              </div>

              <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm text-muted-foreground">
                <Trust icon={MailCheck}>Read-only Gmail</Trust>
                <Trust icon={ShieldCheck}>Only order emails</Trust>
                <Trust icon={Lock}>Private to you</Trust>
              </ul>
            </div>

            <ProductPreview />
          </section>
        </div>

        {/* Shops */}
        <section className="border-y border-border">
          <div className="mx-auto max-w-6xl px-5 py-8 md:px-10">
            <p className="text-center text-sm text-muted-foreground">
              Works with order emails from
            </p>
            <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
              {SHOPS.map((s) => (
                <li
                  key={s}
                  className="flex items-center gap-2.5 text-[16px] font-semibold tracking-tight text-foreground/70"
                >
                  <MerchantAvatar platform={s} size="sm" />
                  {s}
                </li>
              ))}
              <li className="text-[15px] text-muted-foreground">and many more</li>
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how"
          className="relative isolate scroll-mt-20 mx-auto max-w-6xl px-5 py-24 md:px-10 md:py-32"
        >
          <div className="backdrop overflow-visible" aria-hidden>
            <div className="glow glow-violet -left-[20%] top-[20%] h-[420px] w-[min(620px,90vw)] opacity-70" />
          </div>
          <SectionHead
            title="Set up in about a minute"
            text="No forwarding rules, no apps to install. Sign in once and sync whenever you like."
          />
          <ol className="mt-14 grid gap-1 overflow-hidden rounded-xl md:grid-cols-3">
            {[
              [
                "Sign in with Google",
                "Grant read-only access to Gmail. Haul can't send, delete or change anything in your inbox.",
              ],
              [
                "Sync your inbox",
                "Haul looks for order confirmations, shipping updates and receipts — and skips everything else.",
              ],
              [
                "See it all in one place",
                "Every order with its items, price, status and delivery date, searchable in seconds.",
              ],
            ].map(([title, text], i) => (
              <li key={title} className="bg-card p-7 md:p-8">
                <span className="font-mono text-sm text-primary">0{i + 1}</span>
                <h3 className="mt-6 text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 bg-surface">
          <div className="mx-auto max-w-6xl space-y-24 px-5 py-24 md:space-y-32 md:px-10 md:py-32">
            <Split
              title="Know what's arriving, and when."
              text="Shipping emails get turned into a simple progress line, so you can see what's packed, what's on the road and what's due today."
              points={[
                "Delivery progress at a glance",
                "Expected dates pulled from shipping emails",
                "Return windows you won't forget",
              ]}
              figure={<TransitFigure />}
            />
            <Split
              flip
              title="See where your money goes."
              text="Because every receipt is in one place, the totals add themselves up — by month, by category and by shop."
              points={[
                "Monthly spending",
                "Food, shopping, grocery, travel",
                "Your most-used shops",
              ]}
              figure={<SpendFigure />}
            />
          </div>
        </section>

        {/* Privacy */}
        <section
          id="privacy"
          className="relative isolate scroll-mt-20 mx-auto max-w-6xl px-5 py-24 md:px-10 md:py-32"
        >
          <div className="backdrop overflow-visible" aria-hidden>
            <div className="glow glow-coral -right-[18%] top-[25%] h-[420px] w-[min(600px,90vw)] opacity-80" />
          </div>
          <SectionHead
            title="Your inbox stays yours"
            text="Here's exactly what Haul does with access to your Gmail — and what it never does."
          />
          <div className="mt-14 grid gap-1 overflow-hidden rounded-xl md:grid-cols-2">
            <div className="bg-card p-7 md:p-9">
              <h3 className="text-sm font-semibold text-ok">Haul can</h3>
              <ul className="mt-5 space-y-4">
                <Point ok>
                  Read emails in Gmail's Purchases and Reservations tabs, and emails whose subject
                  mentions an order, receipt, invoice, shipment, delivery or booking
                </Point>
                <Point ok>
                  Use Google's Gemini AI to pull the order details out of those emails
                </Point>
                <Point ok>
                  Save the shop, items, price, status and dates — not the whole email
                </Point>
              </ul>
            </div>
            <div className="bg-card p-7 md:p-9">
              <h3 className="text-sm font-semibold text-bad">Haul can't</h3>
              <ul className="mt-5 space-y-4">
                <Point>Send, delete, archive or change any email</Point>
                <Point>Show your orders to anyone but you</Point>
                <Point>Share or sell your data</Point>
              </ul>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            You can remove Haul's access at any time from your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
            >
              Google account settings
            </a>
            . Full details are in the{" "}
            <Link
              to="/privacy"
              className="font-semibold text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
            >
              privacy policy
            </Link>
            .
          </p>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-surface">
          <div className="mx-auto max-w-3xl px-5 py-24 md:px-10 md:py-32">
            <SectionHead title="Questions" />
            <div className="mt-12 space-y-1">
              <Faq q="Which shops does it work with?">
                Any shop that emails you an order confirmation, invoice or shipping update — Amazon,
                Flipkart, Swiggy, Zomato, Myntra, Blinkit, BookMyShow and many more. Shops Haul
                doesn't recognise by name still show up under their own name.
              </Faq>
              <Faq q="Does Haul read all of my email?">
                No. It only opens emails Gmail files under Purchases or Reservations, or whose
                subject looks like an order, receipt, invoice, shipment, delivery or booking — and
                from those it keeps just the order details.
              </Faq>
              <Faq q="How do new orders show up?">
                Automatically: while Haul is open, it quietly checks for new order emails every 30
                minutes. You can also press Sync any time. Emails already in your list are skipped,
                so each sync is quick.
              </Faq>
              <Faq q="What if an order looks wrong?">
                Order emails come in many formats, so now and then a detail can be missed. Open the
                order to see what was found — the original email is always still in your Gmail.
              </Faq>
              <Faq q="How do I disconnect?">
                Sign out from Settings, and remove Haul at myaccount.google.com/permissions. After
                that it can't read anything in your inbox.
              </Faq>
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto max-w-6xl px-5 py-24 md:px-10 md:py-32">
          <div className="relative isolate overflow-hidden rounded-xl bg-foreground px-6 py-16 text-center text-background md:px-16 md:py-20">
            <div className="backdrop" aria-hidden>
              <div className="glow glow-violet -left-[10%] -top-[40%] h-[420px] w-[min(640px,100%)] [--glow-1:rgb(124_92_255/0.55)]" />
              <div className="glow glow-coral -bottom-[50%] -right-[10%] h-[400px] w-[min(560px,100%)] [--glow-2:rgb(255_122_89/0.4)]" />
            </div>
            <h2 className="mx-auto max-w-2xl text-[34px] font-semibold leading-tight tracking-[-0.03em] md:text-[44px]">
              Your orders are already in your inbox.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[17px] text-background/70">
              Bring them together in one list — it takes about a minute.
            </p>
            <div className="mt-9 flex justify-center">
              <GoogleButton onClick={google.signIn} pending={google.isPending} inverted />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <Brand to="/" className="text-[17px]" />
            <p className="mt-1">Every online order, in one list.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#privacy" className="hover:text-foreground">
              Privacy
            </a>
            <a href="#faq" className="hover:text-foreground">
              Questions
            </a>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy policy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </nav>
          <p>© {new Date().getFullYear()} Haul</p>
        </div>
      </footer>
    </div>
  );
}

function GoogleButton({
  onClick,
  pending,
  inverted,
}: {
  onClick: () => void;
  pending: boolean;
  inverted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-3 whitespace-nowrap rounded-full px-7 text-[15px] font-semibold disabled:opacity-60",
        inverted
          ? "bg-background text-foreground transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97]"
          : "btn-cta",
      )}
    >
      <GoogleIcon />
      {pending ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}

function Trust({ icon: Icon, children }: { icon: typeof Lock; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 whitespace-nowrap">
      <Icon className="h-4 w-4 shrink-0 text-ok" aria-hidden />
      {children}
    </li>
  );
}

function SectionHead({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[46px]">
        {title}
      </h2>
      {text && <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">{text}</p>}
    </div>
  );
}

function Split({
  title,
  text,
  points,
  figure,
  flip,
}: {
  title: string;
  text: string;
  points: string[];
  figure: ReactNode;
  flip?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-12 lg:gap-20",
        flip ? "lg:grid-cols-[6fr_5fr]" : "lg:grid-cols-[5fr_6fr]",
      )}
    >
      <div className={cn(flip && "lg:order-2")}>
        <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[42px]">
          {title}
        </h2>
        <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">{text}</p>
        <ul className="mt-7 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-3 text-[15px]">
              <Check className="h-5 w-5 shrink-0 text-ok" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div aria-hidden>{figure}</div>
    </div>
  );
}

function Point({ ok, children }: { ok?: boolean; children: ReactNode }) {
  const Icon = ok ? Check : X;
  return (
    <li className="flex items-start gap-3 text-[15px] leading-relaxed">
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ok ? "text-ok" : "text-bad")} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg bg-card [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[17px] font-semibold">
        {q}
        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <p className="px-6 pb-6 text-[15px] leading-relaxed text-muted-foreground">{children}</p>
    </details>
  );
}

/* ---------- illustrations: the app's own pieces, drawn with sample data ---------- */

function ProductPreview() {
  return (
    <div className="hidden sm:block" aria-hidden>
      <div className="rounded-xl bg-surface p-3 md:p-4">
        <div className="flex items-center justify-between px-2 pb-3 pt-1">
          <span className="text-sm font-semibold">Recent orders</span>
          <span className="text-xs text-muted-foreground">October</span>
        </div>
        <div className="grid gap-px overflow-hidden rounded-lg bg-border">
          {PREVIEW.map((o) => (
            <div key={o.item} className="flex items-center gap-4 bg-card px-4 py-3.5 sm:px-5">
              <MerchantAvatar platform={o.platform} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{o.item}</div>
                <div className="mt-0.5 text-[13px] text-muted-foreground">
                  {o.platform === o.shop ? o.platform : `${o.platform} · ${o.shop}`} · {o.when}
                </div>
              </div>
              <div className="hidden w-32 shrink-0 md:block">
                <StatusBadge status={o.status} />
                {o.note && <div className="mt-1 text-xs text-muted-foreground">{o.note}</div>}
              </div>
              <div className="w-20 shrink-0 text-right text-[15px] font-semibold tabular-nums">
                {formatCurrency(o.amount)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-2 pb-1 pt-4 text-sm">
          <span className="text-muted-foreground">Spent this month</span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(PREVIEW.reduce((s, o) => s + o.amount, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}

function TransitFigure() {
  const cards: {
    platform: Platform;
    item: string;
    status: OrderStatus;
    step: number;
    when: string;
  }[] = [
    {
      platform: "Amazon",
      item: "Boat Rockerz 450",
      status: "out_for_delivery",
      step: 2,
      when: "Arrives today",
    },
    {
      platform: "Flipkart",
      item: "Prestige kettle 1.5L",
      status: "shipped",
      step: 1,
      when: "Arrives in 2 days",
    },
  ];
  return (
    <div className="grid gap-1 overflow-hidden rounded-xl">
      {cards.map((c) => (
        <div key={c.item} className="bg-card p-6">
          <div className="flex items-center gap-3">
            <MerchantAvatar platform={c.platform} size="sm" />
            <div>
              <div className="text-[15px] font-medium">{c.item}</div>
              <div className="text-[13px] text-muted-foreground">{c.platform}</div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn("h-1.5 rounded-full", i <= c.step ? "bg-primary" : "bg-surface-2")}
              />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1 text-[11px] text-muted-foreground">
            <span>Ordered</span>
            <span>Shipped</span>
            <span>Out for delivery</span>
            <span>Delivered</span>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <StatusBadge status={c.status} />
            <span className="text-[13px] text-muted-foreground">{c.when}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SpendFigure() {
  const months = [
    ["May", 42],
    ["Jun", 58],
    ["Jul", 36],
    ["Aug", 71],
    ["Sep", 49],
    ["Oct", 64],
  ] as const;
  const cats = [
    ["Shopping", 46, "var(--chart-1)"],
    ["Food", 28, "var(--chart-2)"],
    ["Grocery", 17, "var(--chart-3)"],
    ["Travel", 9, "var(--chart-5)"],
  ] as const;
  return (
    <div className="grid gap-1 overflow-hidden rounded-xl">
      <div className="bg-card p-6">
        <div className="text-sm font-semibold">Monthly spending</div>
        <div className="mt-6 flex h-36 items-end gap-3">
          {months.map(([m, v]) => (
            <div key={m} className="flex flex-1 flex-col items-center gap-2">
              <div
                className={cn(
                  "w-full max-w-9 rounded-t-[4px]",
                  m === "Oct" ? "bg-primary" : "bg-primary/35",
                )}
                style={{ height: `${v * 1.8}px` }}
              />
              <span className="text-xs text-muted-foreground">{m}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-card p-6">
        <div className="text-sm font-semibold">By category</div>
        <div className="mt-4 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
          {cats.map(([name, v, c]) => (
            <span key={name} style={{ width: `${v}%`, background: c }} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {cats.map(([name, v, c]) => (
            <div key={name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
              <span className="flex-1">{name}</span>
              <span className="tabular-nums text-muted-foreground">{v}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 rounded-full bg-white p-[3px]" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
