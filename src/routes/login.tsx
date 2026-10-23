import { createFileRoute, redirect } from "@tanstack/react-router";

// Sign-in lives on the home page now; keep /login working for old links and bookmarks
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
