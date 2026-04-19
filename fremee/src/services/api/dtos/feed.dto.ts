import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";

export type FeedItemDto = {
  id: string;
  userName: string;
  avatarLabel: string;
  avatarImage: string | null;
  subtitle: string;
  text: string;
  caption?: string | null;
  hasImage: boolean;
  coverImage: string | null;
  plan: FeedPlanItemDto;
  initiallyLiked: boolean;
  initialLikeCount: number;
  photosSnapshot: { url: string }[] | null;
  itinerarySnapshot: { titulo: string; tipo: string; inicio_at: string; ubicacion_nombre: string }[] | null;
  expensesSnapshot: { total: number; currency: string } | null;
};
