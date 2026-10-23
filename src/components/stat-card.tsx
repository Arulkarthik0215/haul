import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
}

/** A single figure on a flat tile; group tiles with <StatGrid>. */
export function StatCard({ label, value, hint, icon: Icon, className }: Props) {
  return (
    <div className={cn("bg-card p-5", className)}>
      <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </div>
      <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </div>
      {hint && <div className="mt-2 text-[13px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-1 overflow-hidden rounded-lg lg:grid-cols-4", className)}
    >
      {children}
    </div>
  );
}
