import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase/firestore";

type CreateCommentInput = {
  planId: number;
  userId: string;
  userName: string;
  userProfileImage?: string | null;
  content: string;
  parentId?: string | null;
};

type CreateCommentResult = {
  ok: true;
  comment_id: string;
};

export type TopCommentDto = {
  planId: number;
  commentId: string;
  userId: string;
  userName: string | null;
  content: string;
  likeCount: number;
  createdAt: string | null;
  likedByMe: boolean;
  parentId: string | null;
};

export type CommentDto = TopCommentDto;

type ToggleCommentLikeInput = {
  planId: number;
  commentId: string;
  userId: string;
};

type ToggleCommentLikeResult = {
  liked: boolean;
  likeCount: number;
};

function getPostId(planId: number): string {
  return `plan_${planId}`;
}

function toIsoOrNull(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate !== "function") return null;
  return maybeTimestamp.toDate().toISOString();
}

async function getTopCommentInternal(planId: number, userId?: string): Promise<TopCommentDto | null> {
  const commentsRef = collection(db, "posts", getPostId(planId), "comments");
  const topByLikeSnap = await getDocs(query(commentsRef, orderBy("likeCount", "desc"), limit(1)));
  const topByLike = topByLikeSnap.docs[0];

  let row: QueryDocumentSnapshot | undefined = topByLike;
  const topByLikeCountRaw = topByLike?.data().likeCount;
  const topByLikeCount =
    typeof topByLikeCountRaw === "number" && Number.isFinite(topByLikeCountRaw) ? topByLikeCountRaw : 0;

  if (topByLike && topByLikeCount <= 0) {
    const newestSnap = await getDocs(query(commentsRef, orderBy("created_at", "desc"), limit(1)));
    row = newestSnap.docs[0];
  }

  if (!row) return null;

  const data = row.data();
  const rawLikeCount = data.likeCount;
  const likeCount = typeof rawLikeCount === "number" && Number.isFinite(rawLikeCount) ? rawLikeCount : 0;

  let likedByMe = false;
  if (userId) {
    const likeRef = doc(db, "posts", getPostId(planId), "comments", row.id, "likes", userId);
    const likeSnap = await getDoc(likeRef);
    likedByMe = likeSnap.exists();
  }

  return {
    planId,
    commentId: row.id,
    userId: typeof data.user_id === "string" ? data.user_id : "",
    userName: typeof data.user_name === "string" ? data.user_name : null,
    content: typeof data.content === "string" ? data.content : "",
    likeCount,
    createdAt: toIsoOrNull(data.created_at),
    likedByMe,
    parentId: typeof data.parent_id === "string" ? data.parent_id : null,
  };
}

async function listCommentsInternal(params: {
  planId: number;
  userId?: string;
  maxItems: number;
}): Promise<CommentDto[]> {
  const commentsRef = collection(db, "posts", getPostId(params.planId), "comments");
  const commentsSnap = await getDocs(query(commentsRef, orderBy("created_at", "desc"), limit(params.maxItems)));

  const comments = await Promise.all(
    commentsSnap.docs.map(async (row) => {
      const data = row.data();
      const rawLikeCount = data.likeCount;
      const likeCount = typeof rawLikeCount === "number" && Number.isFinite(rawLikeCount) ? rawLikeCount : 0;

      let likedByMe = false;
      if (params.userId) {
        const likeRef = doc(db, "posts", getPostId(params.planId), "comments", row.id, "likes", params.userId);
        const likeSnap = await getDoc(likeRef);
        likedByMe = likeSnap.exists();
      }

      return {
        planId: params.planId,
        commentId: row.id,
        userId: typeof data.user_id === "string" ? data.user_id : "",
        userName: typeof data.user_name === "string" ? data.user_name : null,
        content: typeof data.content === "string" ? data.content : "",
        likeCount,
        createdAt: toIsoOrNull(data.created_at),
        likedByMe,
        parentId: typeof data.parent_id === "string" ? data.parent_id : null,
      } satisfies CommentDto;
    }),
  );

  return comments;
}

export async function createCommentRoute(input: CreateCommentInput): Promise<CreateCommentResult> {
  const content = input.content.trim();
  if (!content) {
    throw new Error("El comentario no puede estar vacio");
  }

  const commentRef = await addDoc(collection(db, "posts", getPostId(input.planId), "comments"), {
    planId: input.planId,
    user_id: input.userId,
    user_name: input.userName,
    profile_image: input.userProfileImage ?? null,
    content,
    likeCount: 0,
    parent_id: input.parentId ?? null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  return { ok: true, comment_id: commentRef.id };
}

export async function toggleCommentLikeRoute(input: ToggleCommentLikeInput): Promise<ToggleCommentLikeResult> {
  const commentRef = doc(db, "posts", getPostId(input.planId), "comments", input.commentId);
  const likeRef = doc(db, "posts", getPostId(input.planId), "comments", input.commentId, "likes", input.userId);

  return runTransaction(db, async (tx) => {
    const [commentSnap, likeSnap] = await Promise.all([tx.get(commentRef), tx.get(likeRef)]);
    if (!commentSnap.exists()) {
      throw new Error("Comment not found");
    }

    const rawLikeCount = commentSnap.data().likeCount;
    const currentCount = typeof rawLikeCount === "number" && Number.isFinite(rawLikeCount) ? rawLikeCount : 0;

    if (likeSnap.exists()) {
      const likeCount = Math.max(0, currentCount - 1);
      tx.delete(likeRef);
      tx.set(commentRef, { likeCount, updated_at: serverTimestamp() }, { merge: true });
      return { liked: false, likeCount };
    }

    const likeCount = currentCount + 1;
    tx.set(
      likeRef,
      {
        user_id: input.userId,
        created_at: serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(commentRef, { likeCount, updated_at: serverTimestamp() }, { merge: true });
    return { liked: true, likeCount };
  });
}

export async function getTopCommentForPlanRoute(params: {
  planId: number;
  userId?: string;
}): Promise<TopCommentDto | null> {
  return getTopCommentInternal(params.planId, params.userId);
}

export async function listTopCommentsForPlansRoute(params: {
  planIds: number[];
  userId?: string;
}): Promise<{ topCommentsByPlanId: Record<number, TopCommentDto | null> }> {
  const uniquePlanIds = [...new Set(params.planIds)].filter(
    (planId) => Number.isInteger(planId) && planId > 0,
  );

  const entries = await Promise.all(
    uniquePlanIds.map(async (planId) => {
      const top = await getTopCommentInternal(planId, params.userId);
      return [planId, top] as const;
    }),
  );

  const topCommentsByPlanId: Record<number, TopCommentDto | null> = {};
  for (const [planId, top] of entries) {
    topCommentsByPlanId[planId] = top;
  }

  return { topCommentsByPlanId };
}

export async function listCommentsForPlanRoute(params: {
  planId: number;
  userId?: string;
  limit?: number;
}): Promise<{ comments: CommentDto[] }> {
  const safeLimit = Number.isFinite(params.limit) ? Math.max(1, Math.min(100, Number(params.limit))) : 30;
  const comments = await listCommentsInternal({
    planId: params.planId,
    userId: params.userId,
    maxItems: safeLimit,
  });
  return { comments };
}

export async function deleteCommentRoute(params: {
  planId: number;
  commentId: string;
}): Promise<void> {
  const commentRef = doc(db, "posts", getPostId(params.planId), "comments", params.commentId);
  await deleteDoc(commentRef);
}

export async function listPreviewCommentsForPlansRoute(params: {
  planIds: number[];
  userId?: string;
  limitPerPlan?: number;
}): Promise<{ previewCommentsByPlanId: Record<number, CommentDto[]> }> {
  const uniquePlanIds = [...new Set(params.planIds)].filter(
    (planId) => Number.isInteger(planId) && planId > 0,
  );
  const safeLimit = Number.isFinite(params.limitPerPlan)
    ? Math.max(1, Math.min(5, Number(params.limitPerPlan)))
    : 2;

  const entries = await Promise.all(
    uniquePlanIds.map(async (planId) => {
      const comments = await listCommentsInternal({
        planId,
        userId: params.userId,
        maxItems: safeLimit,
      });
      return [planId, comments] as const;
    }),
  );

  const previewCommentsByPlanId: Record<number, CommentDto[]> = {};
  for (const [planId, comments] of entries) {
    previewCommentsByPlanId[planId] = comments;
  }

  return { previewCommentsByPlanId };
}
