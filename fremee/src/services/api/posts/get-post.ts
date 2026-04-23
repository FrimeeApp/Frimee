import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firestore";
import type {
  PublicationConfig,
  ItinerarySnapshotItem,
  PhotoSnapshot,
  ExpensesSnapshot,
  ParticipantsSnapshot,
} from "@/services/api/dtos/plan.dto";

export type PostDoc = {
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
  creator: { id: string; name: string; profileImage: string | null } | null;
  likeCount: number;
  published: boolean;
  publishedAt: { seconds: number } | null;
  publicationConfig: PublicationConfig | null;
  itinerarySnapshot: ItinerarySnapshotItem[] | null;
  photosSnapshot: PhotoSnapshot[] | null;
  expensesSnapshot: ExpensesSnapshot | null;
  participantsSnapshot: ParticipantsSnapshot | null;
};

export async function getPostByPlanId(planId: number): Promise<PostDoc | null> {
  const snap = await getDoc(doc(db, "posts", `plan_${planId}`));
  if (!snap.exists()) return null;
  return snap.data() as PostDoc;
}
