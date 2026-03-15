import type { UserAuthSnapshotDto } from "@/services/api/repositories/users.repository";

type SnapshotCacheStore = {
  byUserId: Record<string, UserAuthSnapshotDto>;
};

const SNAPSHOT_CACHE_KEY = "fremee.auth_snapshot.v1";

function readStore(): SnapshotCacheStore {
  if (typeof window === "undefined") return { byUserId: {} };
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!raw) return { byUserId: {} };
    const parsed = JSON.parse(raw) as SnapshotCacheStore;
    if (!parsed || typeof parsed !== "object" || !parsed.byUserId) {
      return { byUserId: {} };
    }
    return parsed;
  } catch {
    return { byUserId: {} };
  }
}

function writeStore(store: SnapshotCacheStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
}

export function readCachedUserSnapshot(userId: string): UserAuthSnapshotDto | null {
  const store = readStore();
  return store.byUserId[userId] ?? null;
}

export function cacheUserSnapshot(userId: string, snapshot: UserAuthSnapshotDto) {
  const store = readStore();
  store.byUserId[userId] = snapshot;
  writeStore(store);
}

export function clearCachedUserSnapshot(userId: string) {
  const store = readStore();
  if (!(userId in store.byUserId)) return;
  delete store.byUserId[userId];
  writeStore(store);
}
