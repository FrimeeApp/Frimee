import { STORAGE_KEYS, STORAGE_TTLS } from "@/config/storage";

const GOOGLE_TOKEN_CACHE_KEY = STORAGE_KEYS.googleTokenCache;
const GOOGLE_TOKEN_TTL_MS = STORAGE_TTLS.googleTokenCacheMs;

type CachedGoogleToken = {
  token: string;
  cachedAt: number;
};

type GoogleTokenCache = {
  byUserId: Record<string, CachedGoogleToken | string>;
};

function readRawCache(): GoogleTokenCache {
  if (typeof window === "undefined") {
    return { byUserId: {} };
  }

  try {
    const raw = window.localStorage.getItem(GOOGLE_TOKEN_CACHE_KEY);
    if (!raw) return { byUserId: {} };
    const parsed = JSON.parse(raw) as Partial<GoogleTokenCache>;
    return {
      byUserId: parsed.byUserId ?? {},
    };
  } catch {
    return { byUserId: {} };
  }
}

function writeRawCache(cache: GoogleTokenCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GOOGLE_TOKEN_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
}

export function readCachedGoogleProviderToken(userId: string): string | null {
  const cache = readRawCache();
  const entry = cache.byUserId[userId];
  if (!entry) return null;
  if (typeof entry === "string") {
    cache.byUserId[userId] = { token: entry, cachedAt: Date.now() };
    writeRawCache(cache);
    return entry;
  }
  if (!entry.token || !entry.cachedAt) {
    return null;
  }

  if (Date.now() - entry.cachedAt > GOOGLE_TOKEN_TTL_MS) {
    delete cache.byUserId[userId];
    writeRawCache(cache);
    return null;
  }

  return entry.token;
}

export function cacheGoogleProviderToken(userId: string, token: string) {
  const cache = readRawCache();
  cache.byUserId[userId] = { token, cachedAt: Date.now() };
  writeRawCache(cache);
}

export function clearCachedGoogleProviderToken(userId: string) {
  const cache = readRawCache();
  if (!(userId in cache.byUserId)) return;
  delete cache.byUserId[userId];
  writeRawCache(cache);
}
