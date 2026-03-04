import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/services/firebase/firestore";

type FeedPostDoc = {
  planId?: number;
  published?: boolean;
};

export async function listPublishedPostPlanIdsRoute(params: { limit: number }): Promise<number[]> {
  const postsRef = collection(db, "posts");
  const q = query(
    postsRef,
    where("published", "==", true),
    orderBy("publishedAt", "desc"),
    limit(params.limit),
  );
  const snap = await getDocs(q);

  const ids = snap.docs
    .map((d) => d.data() as FeedPostDoc)
    .map((d) => d.planId)
    .filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0);

  return [...new Set(ids)];
}
