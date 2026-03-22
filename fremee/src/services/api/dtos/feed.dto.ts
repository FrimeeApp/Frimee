import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";

export type FeedItemDto = {
  id: string;
  userName: string;
  avatarLabel: string;
  avatarImage: string | null;
  subtitle: string;
  text: string;
  hasImage: boolean;
  coverImage: string | null;
  plan: FeedPlanItemDto;
  initiallyLiked: boolean;
  initialLikeCount: number;
};
