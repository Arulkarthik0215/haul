import { cn } from "@/lib/utils";
import { getPlatformMeta } from "@/lib/platforms";
import type { Platform } from "@/types/order";
import amazon from "@/assets/merchants/amazon.png";
import blinkit from "@/assets/merchants/blinkit.png";
import bookmyshow from "@/assets/merchants/bookmyshow.png";
import flipkart from "@/assets/merchants/flipkart.png";
import myntra from "@/assets/merchants/myntra.png";
import swiggy from "@/assets/merchants/swiggy.png";
import uber from "@/assets/merchants/uber.png";
import zepto from "@/assets/merchants/zepto.png";
import zomato from "@/assets/merchants/zomato.png";

// The shops' own app icons, bundled so no third party learns which shops a user orders from.
// Shops without a sharp icon fall back to a tinted monogram.
const logos: Partial<Record<Platform, string>> = {
  Amazon: amazon,
  Blinkit: blinkit,
  BookMyShow: bookmyshow,
  Flipkart: flipkart,
  Myntra: myntra,
  Swiggy: swiggy,
  Uber: uber,
  Zepto: zepto,
  Zomato: zomato,
};

interface Props {
  platform: Platform;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-8 w-8 text-xs rounded-lg",
  md: "h-10 w-10 text-sm rounded-[11px]",
  lg: "h-14 w-14 text-xl rounded-2xl",
};

export function MerchantAvatar({ platform, size = "md", className }: Props) {
  const meta = getPlatformMeta(platform);
  const logo = logos[platform];
  const base = cn(
    "flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-inset ring-black/[0.06] dark:ring-white/10",
    sizes[size],
    className,
  );

  if (logo) {
    return (
      <div className={cn(base, "bg-white")} aria-label={platform}>
        <img src={logo} alt="" className="h-full w-full object-cover" draggable={false} />
      </div>
    );
  }
  return (
    <div
      className={cn(base, "font-bold")}
      style={{
        color: meta.color,
        background: `linear-gradient(145deg, color-mix(in oklch, ${meta.color} 22%, transparent), color-mix(in oklch, ${meta.color} 8%, transparent))`,
      }}
      aria-label={platform}
    >
      {meta.letter}
    </div>
  );
}
