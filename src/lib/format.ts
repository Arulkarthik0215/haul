export function formatCurrency(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 24 * 3600 * 1000;
  if (diff < 0) return dueLabel(iso);
  if (diff < 3600 * 1000) return "Just now";
  if (diff < day) return `${Math.floor(diff / (3600 * 1000))}h ago`;
  const days = Math.floor(diff / day);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** For dates ahead of now: "today", "tomorrow", "in 3 days", "on 12 Oct". */
export function dueLabel(iso: string) {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(
    (startOfDay(new Date(iso)) - startOfDay(new Date())) / (24 * 3600 * 1000),
  );
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  return `on ${new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

/** relativeTime phrased for the middle of a sentence: "just now", "3h ago", "yesterday", "on 12 Oct". */
export function relativePhrase(iso: string) {
  const rel = relativeTime(iso);
  if (rel === "Just now" || rel === "Yesterday") return rel.toLowerCase();
  if (rel.endsWith("ago") || /^(today|tomorrow|in |on )/.test(rel)) return rel;
  return `on ${rel}`;
}
