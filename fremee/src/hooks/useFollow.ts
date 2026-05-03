import { useState, useEffect } from "react";
import { followUser, unfollowUser } from "@/services/api/endpoints/users.endpoint";
import { insertNotificacion } from "@/services/api/repositories/notifications.repository";

export function useFollow(
  targetUserId: string | null | undefined,
  currentUserId: string | null | undefined,
  initialFollowing: boolean,
  onFollowingChange?: (following: boolean) => void
) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);
  const [showUnfollowDialog, setShowUnfollowDialog] = useState(false);

  const handleFollow = async () => {
    if (!targetUserId || !currentUserId || loading) return;
    setLoading(true);
    setFollowing(true); // optimistic
    try {
      await followUser(targetUserId);
      if (targetUserId !== currentUserId) {
        void insertNotificacion({
          userId: targetUserId,
          tipo: "follow",
          actorId: currentUserId,
          entityId: currentUserId,
          entityType: "user",
        }).catch((error) => {
          console.error("[useFollow] Error insertando notificación follow:", error);
        });
      }
      onFollowingChange?.(true);
    } catch {
      setFollowing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!targetUserId || !currentUserId || loading) return;
    setShowUnfollowDialog(false);
    setLoading(true);
    setFollowing(false); // optimistic
    try {
      await unfollowUser(targetUserId);
      onFollowingChange?.(false);
    } catch {
      setFollowing(true);
    } finally {
      setLoading(false);
    }
  };

  const onPress = () => {
    if (following) {
      setShowUnfollowDialog(true);
    } else {
      void handleFollow();
    }
  };

  return { following, loading, showUnfollowDialog, setShowUnfollowDialog, onPress, handleUnfollow };
}
