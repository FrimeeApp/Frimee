import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";

export type FeedItemDto = {
  id: string;
  userName: string;
  userUsername: string | null;
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
};
