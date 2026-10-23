import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** The Haul wordmark — plain type, no icon. */
export function Brand({
  to = "/dashboard",
  className,
}: {
  to?: "/" | "/dashboard";
  className?: string;
}) {
  return (
    <Link
      to={to}
      aria-label="Haul home"
      className={cn("text-[18px] font-bold uppercase tracking-[0.22em] text-foreground", className)}
    >
      Haul
    </Link>
  );
}
