import type { PublishPostPayload } from "@/services/api/mappers/post.mapper";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase/firestore";

type PublishPostResult = { ok: true; post_id: string; alreadyPublished: boolean };

export async function publishPostRoute(payload: PublishPostPayload): Promise<PublishPostResult> {
  const postId = `plan_${payload.plan.id}`;
  const postRef = doc(db, "posts", postId);

  const created = await runTransaction(db, async (tx) => {
    const existing = await tx.get(postRef);
    if (existing.exists()) return false;

    tx.set(postRef, {
      planId: payload.plan.id,
      plan: payload.plan,
      createdAt: serverTimestamp(),
    });
    return true;
  });

  return { ok: true, post_id: postRef.id, alreadyPublished: !created };
}
