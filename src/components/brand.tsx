import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** The OrderHub wordmark — plain type, no icon. */
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
      aria-label="OrderHub home"
      className={cn("text-[19px] font-semibold tracking-[-0.03em] text-foreground", className)}
    >
      OrderHub
    </Link>
  );
}
