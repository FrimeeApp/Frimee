import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase/firestore";

type TogglePlanLikeInput = {
  planId: number;
  userId: string;
};

type TogglePlanLikeResult = {
  liked: boolean;
  likeCount: number;
};

type ListUserPlanLikesInput = {
  userId: string;
  planIds: number[];
};

type ListUserPlanLikesResult = {
  likedPlanIds: number[];
};

type ListPlanLikeCountsInput = {
  planIds: number[];
};

type ListPlanLikeCountsResult = {
  likeCountsByPlanId: Record<number, number>;
};

function getPostId(planId: number): string {
  return `plan_${planId}`;
}

export async function togglePlanLikeRoute(input: TogglePlanLikeInput): Promise<TogglePlanLikeResult> {
  const postRef = doc(db, "posts", getPostId(input.planId));
  const likeRef = doc(db, "posts", getPostId(input.planId), "likes", input.userId);

  return runTransaction(db, async (tx) => {
    const [postSnap, likeSnap] = await Promise.all([tx.get(postRef), tx.get(likeRef)]);
    const postData = postSnap.exists() ? postSnap.data() : {};
    const currentCountRaw = postData?.likeCount;
    const currentCount =
      typeof currentCountRaw === "number" && Number.isFinite(currentCountRaw) ? currentCountRaw : 0;

    if (likeSnap.exists()) {
      const likeCount = Math.max(0, currentCount - 1);
      tx.delete(likeRef);
      tx.set(postRef, { planId: input.planId, likeCount, updatedAt: serverTimestamp() }, { merge: true });

      return { liked: false, likeCount };
    }

    const likeCount = currentCount + 1;
    tx.set(
      likeRef,
      {
        created_at: serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(postRef, { planId: input.planId, likeCount, updatedAt: serverTimestamp() }, { merge: true });

    return { liked: true, likeCount };
  });
}

export async function listUserPlanLikesRoute(input: ListUserPlanLikesInput): Promise<ListUserPlanLikesResult> {
  const uniquePlanIds = [...new Set(input.planIds)].filter(
    (planId) => Number.isInteger(planId) && planId > 0,
  );

  if (!uniquePlanIds.length) {
    return { likedPlanIds: [] };
  }

  const checks = await Promise.all(
    uniquePlanIds.map(async (planId) => {
      const likeRef = doc(db, "posts", getPostId(planId), "likes", input.userId);
      const likeSnap = await getDoc(likeRef);
      return likeSnap.exists() ? planId : null;
    }),
  );

  const likedPlanIds: number[] = [];
  for (const planId of checks) {
    if (typeof planId === "number") {
      likedPlanIds.push(planId);
    }
  }

  return { likedPlanIds };
}

export async function listPlanLikeCountsRoute(input: ListPlanLikeCountsInput): Promise<ListPlanLikeCountsResult> {
  const uniquePlanIds = [...new Set(input.planIds)].filter(
    (planId) => Number.isInteger(planId) && planId > 0,
  );

  if (!uniquePlanIds.length) {
    return { likeCountsByPlanId: {} };
  }

  const counts: Record<number, number> = {};
  await Promise.all(
    uniquePlanIds.map(async (planId) => {
      const postRef = doc(db, "posts", getPostId(planId));
      const postSnap = await getDoc(postRef);
      const raw = postSnap.exists() ? postSnap.data().likeCount : 0;
      counts[planId] = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    }),
  );

  return { likeCountsByPlanId: counts };
}
