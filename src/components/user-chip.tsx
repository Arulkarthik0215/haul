import { useAuthSession } from "@/hooks/use-auth";

export function useCurrentUser() {
  const { data: session } = useAuthSession();
  const meta = (session?.user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const email = session?.user?.email ?? null;
  const name = meta.full_name || meta.name || (email ? email.split("@")[0] : null);
  return {
    signedIn: !!session,
    email,
    name,
    firstName: name ? name.split(" ")[0] : null,
    avatarUrl: meta.avatar_url || meta.picture || null,
  };
}

export function UserChip() {
  const { name, email, avatarUrl } = useCurrentUser();
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">
          {initial}
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{email}</div>
      </div>
    </div>
  );
}
