import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "orderhub-theme";

// Runs before React hydrates (see __root.tsx) so the first paint already has the right theme:
// the stored choice wins, otherwise the operating system's preference.
export const themeBootScript = `try{var t=localStorage.getItem('${KEY}');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}`;

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(currentTheme());
  }, []);

  const setTheme = (next: Theme) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage unavailable (private mode) — the choice just won't persist
    }
    setThemeState(next);
  };

  return {
    theme,
    setTheme,
    toggle: () => setTheme(currentTheme() === "dark" ? "light" : "dark"),
  };
}
