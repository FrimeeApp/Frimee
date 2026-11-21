import type { PublicUserProfileDto } from "@/services/api/repositories/users.repository";

const MAX_RECENTS = 8;

export type RecentUser = Pick<PublicUserProfileDto, "id" | "nombre" | "username" | "profile_image">;

const keyFor = (userId: string) => `frimee:busquedas-recientes:${userId}`;

export function readRecents(userId: string): RecentUser[] {
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentUser => !!item && typeof item.id === "string" && typeof item.nombre === "string")
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function writeRecents(userId: string, items: RecentUser[]) {
  try {
    if (items.length === 0) window.localStorage.removeItem(keyFor(userId));
    else window.localStorage.setItem(keyFor(userId), JSON.stringify(items.slice(0, MAX_RECENTS)));
  } catch {
    // Sin almacenamiento (modo privado, cuota): simplemente no hay recientes.
  }
}

export function addRecent(userId: string, profile: RecentUser): RecentUser[] {
  const entry: RecentUser = {
    id: profile.id,
    nombre: profile.nombre,
    username: profile.username ?? null,
    profile_image: profile.profile_image ?? null,
  };
  const next = [entry, ...readRecents(userId).filter((item) => item.id !== entry.id)].slice(0, MAX_RECENTS);
  writeRecents(userId, next);
  return next;
}

export function removeRecent(userId: string, profileId: string): RecentUser[] {
  const next = readRecents(userId).filter((item) => item.id !== profileId);
  writeRecents(userId, next);
  return next;
}

export function clearRecents(userId: string) {
  writeRecents(userId, []);
}
