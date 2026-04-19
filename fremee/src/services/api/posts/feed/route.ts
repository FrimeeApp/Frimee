import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/services/firebase/firestore";

type FeedPostDoc = {
  planId?: number;
  published?: boolean;
  title?: string;
  description?: string;
  locationName?: string;
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
  visibility?: string;
  coverImage?: string | null;
  ownerUserId?: string;
  caption?: string | null;
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
  caption: string | null;
  creator: { id: string; name: string; username: string | null; profileImage: string | null } | null;
};

export type FeedPage = {
  entries: FeedPostEntry[];
  cursor: QueryDocumentSnapshot<DocumentData> | null; // null = no hay más
};

function docToEntry(d: QueryDocumentSnapshot<DocumentData>): FeedPostEntry | null {
  const doc = d.data() as FeedPostDoc;
  const planId = doc.planId;
  if (typeof planId !== "number" || !Number.isInteger(planId) || planId <= 0) return null;

  const p = doc.plan;
  const c = doc.creator ?? p?.creator;
  return {
    planId,
    title: doc.title ?? p?.title ?? "",
    description: doc.description ?? p?.description ?? "",
    locationName: doc.locationName ?? p?.locationName ?? "",
    startsAt: doc.startsAt ?? p?.startsAt ?? "",
    endsAt: doc.endsAt ?? p?.endsAt ?? "",
    allDay: doc.allDay ?? p?.allDay ?? false,
    visibility: doc.visibility ?? p?.visibility ?? "PÚBLICO",
    coverImage: doc.coverImage ?? p?.coverImage ?? null,
    ownerUserId: doc.ownerUserId ?? p?.ownerUserId ?? "",
    caption: doc.caption ?? null,
    creator: c?.id && c?.name ? { id: c.id, name: c.name, username: (c as { username?: string | null }).username ?? null, profileImage: c.profileImage ?? null } : null,
  };
}

export async function listPublishedPostPlanIdsRoute(params: {
  limit: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}): Promise<FeedPage> {
  const postsRef = collection(db, "posts");
  const constraints = [
    where("published", "==", true),
    orderBy("publishedAt", "desc"),
    limit(params.limit),
    ...(params.cursor ? [startAfter(params.cursor)] : []),
  ];
  const snap = await getDocs(query(postsRef, ...constraints));

  const seen = new Set<number>();
  const entries: FeedPostEntry[] = [];
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

  for (const d of snap.docs) {
    const entry = docToEntry(d);
    if (!entry || seen.has(entry.planId)) continue;
    seen.add(entry.planId);
    entries.push(entry);
    lastDoc = d;
  }

  // Si devuelve menos de lo pedido, no hay más páginas
  const cursor = snap.docs.length < params.limit ? null : lastDoc;
  return { entries, cursor };
}
