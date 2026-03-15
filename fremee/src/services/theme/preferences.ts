export type AppThemePreference = "SYSTEM" | "LIGHT" | "DARK";

const THEME_STORAGE_KEY = "fremee.theme";

export function normalizeThemePreference(value: unknown): AppThemePreference {
  if (value === "SYSTEM" || value === "LIGHT" || value === "DARK") return value;
  return "SYSTEM";
}

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
    // ignore storage errors
  }
}

export function readCachedThemePreference(): AppThemePreference | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearCachedThemePreference() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
