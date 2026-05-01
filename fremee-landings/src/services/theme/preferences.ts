export type AppThemePreference = "SYSTEM" | "LIGHT" | "DARK";

const THEME_STORAGE_KEY = "frimee.themePreference";

export function applyThemePreference(theme: AppThemePreference) {
  if (typeof window === "undefined") return;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = theme === "DARK" || (theme === "SYSTEM" && prefersDark);
  document.documentElement.classList.toggle("dark", useDark);
}

export function cacheThemePreference(theme: AppThemePreference) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors.
  }
}
