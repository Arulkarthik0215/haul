import { cn } from "@/lib/utils";
import { getPlatformMeta } from "@/lib/platforms";
import type { Platform } from "@/types/order";

interface Props {
  platform: Platform;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-8 w-8 text-xs rounded-md",
  md: "h-10 w-10 text-sm rounded-md",
  lg: "h-14 w-14 text-xl rounded-lg",
};

export function MerchantAvatar({ platform, size = "md", className }: Props) {
  const meta = getPlatformMeta(platform);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold text-white",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: meta.color }}
      aria-label={platform}
    >
      {meta.letter}
    </div>
  );
}
