import { Preferences } from "@capacitor/preferences";

// Stores in Preferences (native) and mirrors writes to localStorage so that
// the session is found regardless of which storage was used in a prior build.
export const capacitorStorage = {
  async getItem(key: string) {
    const { value } = await Preferences.get({ key });
    if (value !== null) return value;
    // Fallback: session may have been written to localStorage by an older build
    try {
      const ls = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      if (ls !== null) {
        // Migrate to Preferences so future reads are fast
        await Preferences.set({ key, value: ls });
        window.localStorage.removeItem(key);
      }
      return ls;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    await Preferences.set({ key, value });
  },
  async removeItem(key: string) {
    await Preferences.remove({ key });
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
  },
};
