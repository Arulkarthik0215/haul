import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Inbox, Sparkles } from "lucide-react";
import { useSignIn } from "@/hooks/use-auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign in · OrderHub" }, { name: "description", content: "Sign in to OrderHub." }],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { mutate: signIn, isPending } = useSignIn();

  const handleGoogleSignIn = () => {
    signIn(undefined, {
      onSuccess: (res) => {
        if (res.data?.url) {
          window.location.href = res.data.url;
        } else {
          // fallback to dashboard if mock login
          navigate({ to: "/" });
        }
      },
      onError: (err) => {
        console.error("Sign in error:", err);
      },
    });
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-status-ordered/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
            <Inbox className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">OrderHub</span>
        </div>

        <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Your inbox is your <br />
          <span className="bg-gradient-to-r from-status-ordered via-status-packed to-status-shipped bg-clip-text text-transparent">
            commerce timeline.
          </span>
        </h1>
        <p className="mt-4 max-w-sm text-center text-sm text-muted-foreground">
          OrderHub reads your order confirmation emails to build a private, unified history of
          everything you've ever bought online.
        </p>

        <div className="mt-10 flex w-full flex-col gap-3">
          <button
            onClick={handleGoogleSignIn}
            disabled={isPending}
            className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <GoogleIcon />
            {isPending ? "Connecting..." : "Continue with Google"}
          </button>
          <button
            onClick={() => navigate({ to: "/" })}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border bg-card text-sm font-medium transition-colors hover:border-foreground/30"
          >
            <Sparkles className="h-4 w-4" />
            Try Demo Mode
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Emails are used only to build your private order history. Nothing is shared or sold.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.68 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4c1.94 0 3.24.83 3.98 1.54l2.72-2.62A9.75 9.75 0 0 0 12 2a10 10 0 1 0 0 20c5.77 0 9.6-4.05 9.6-9.76 0-.66-.07-1.16-.17-1.66H12Z"/>
    </svg>
  );
}
