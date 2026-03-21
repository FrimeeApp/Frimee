import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/services/firebase/firestore";

type FeedPostDoc = {
  planId?: number;
  published?: boolean;
  // campos nuevos (raíz)
  title?: string;
  description?: string;
  locationName?: string;
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
  visibility?: string;
  coverImage?: string | null;
  ownerUserId?: string;
  // campos legacy (dentro de plan)
  plan?: {
    title?: string;
    description?: string;
    locationName?: string;
    startsAt?: string;
    endsAt?: string;
    allDay?: boolean;
    visibility?: string;
    coverImage?: string | null;
    ownerUserId?: string;
    creator?: { id?: string; name?: string; profileImage?: string | null };
  };
  creator?: {
    id?: string;
    name?: string;
    profileImage?: string | null;
  };
};

export type FeedPostEntry = {
  planId: number;
  title: string;
  description: string;
  locationName: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  visibility: string;
  coverImage: string | null;
  ownerUserId: string;
  creator: { id: string; name: string; profileImage: string | null } | null;
};

export async function listPublishedPostPlanIdsRoute(params: { limit: number }): Promise<FeedPostEntry[]> {
  const postsRef = collection(db, "posts");
  const q = query(
    postsRef,
    where("published", "==", true),
    orderBy("publishedAt", "desc"),
    limit(params.limit),
  );
  const snap = await getDocs(q);

  const seen = new Set<number>();
  const entries: FeedPostEntry[] = [];

  for (const d of snap.docs) {
    const doc = d.data() as FeedPostDoc;
    const planId = doc.planId;
    if (typeof planId !== "number" || !Number.isInteger(planId) || planId <= 0) continue;
    if (seen.has(planId)) continue;
    seen.add(planId);

    // Soporta formato nuevo (raíz) y legacy (dentro de plan)
    const p = doc.plan;
    const c = doc.creator ?? p?.creator;
    entries.push({
      planId,
      title: doc.title ?? p?.title ?? "",
      description: doc.description ?? p?.description ?? "",
      locationName: doc.locationName ?? p?.locationName ?? "",
      startsAt: doc.startsAt ?? p?.startsAt ?? "",
      endsAt: doc.endsAt ?? p?.endsAt ?? "",
      allDay: doc.allDay ?? p?.allDay ?? false,
      visibility: doc.visibility ?? p?.visibility ?? "PUBLICO",
      coverImage: doc.coverImage ?? p?.coverImage ?? null,
      ownerUserId: doc.ownerUserId ?? p?.ownerUserId ?? "",
      creator: c?.id && c?.name ? { id: c.id, name: c.name, profileImage: c.profileImage ?? null } : null,
    });
  }

  return entries;
}
