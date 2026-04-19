"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import { useAuth } from "@/providers/AuthProvider";
import { getPublicUserProfile } from "@/services/api/repositories/users.repository";
import { sendFriendRequest, getFriendshipStatuses, getFollowStatuses, removeFriend, getFollowerCount } from "@/services/api/endpoints/users.endpoint";
import { useFollow } from "@/hooks/useFollow";
import { listUserRelatedPlans, listSavedPlans } from "@/services/api/repositories/plans.repository";
import {
  uploadProfileImage,
  saveUserProfileAndSettings,
} from "@/services/api/repositories/settings.repository";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";

type ProfileData = {
  id: string;
  nombre: string;
  profile_image: string | null;
};

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, profile: myProfile, settings, loading: authLoading, refreshProfile } = useAuth();
  const isOwnProfile = user?.id === id;

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [plans, setPlans] = useState<FeedPlanItemDto[]>([]);
  const [savedPlans, setSavedPlans] = useState<FeedPlanItemDto[]>([]);
  const [activeTab, setActiveTab] = useState<"planes" | "guardados">("planes");
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);

  const [initialFollowing, setInitialFollowing] = useState(false);
  const { following, loading: followLoading, showUnfollowDialog, setShowUnfollowDialog, onPress: onFollowPress, handleUnfollow } = useFollow(
    isOwnProfile ? null : id,
    user?.id,
    initialFollowing
  );

  // Friend request state
  const [friendshipStatus, setFriendshipStatus] = useState<"none" | "pending" | "friends">("none");
  const [sendingFriendRequest, setSendingFriendRequest] = useState(false);
  const [showUnfriendDialog, setShowUnfriendDialog] = useState(false);

  const handleAddFriend = async () => {
    if (friendshipStatus !== "none" || sendingFriendRequest) return;
    setSendingFriendRequest(true);
    try {
      await sendFriendRequest(id);
      setFriendshipStatus("pending");
    } catch (err) {
      console.error("[profile] Error sending friend request:", err);
    } finally {
      setSendingFriendRequest(false);
    }
  };

  const handleRemoveFriend = async () => {
    setShowUnfriendDialog(false);
    try {
      await removeFriend(id);
      setFriendshipStatus("none");
    } catch (err) {
      console.error("[profile] Error removing friend:", err);
      setFriendshipStatus("friends");
    }
  };

  const onFriendButtonPress = () => {
    if (friendshipStatus === "friends") {
      setShowUnfriendDialog(true);
    } else {
      void handleAddFriend();
    }
  };

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id || authLoading) return;

    const load = async () => {
      setLoading(true);
      try {
        let profileResult: ProfileData | null;

        if (isOwnProfile && myProfile) {
          profileResult = {
            id: myProfile.id,
            nombre: myProfile.nombre,
            profile_image: myProfile.profile_image,
          };
        } else {
          profileResult = await getPublicUserProfile(id);
        }

        setProfileData(profileResult);

        if (!isOwnProfile) {
          const [friendStatuses, followStatuses] = await Promise.all([
            getFriendshipStatuses([id]),
            getFollowStatuses([id]),
          ]);
          const status = friendStatuses[id] ?? "none";
          setFriendshipStatus(status);
          if (followStatuses[id]) setInitialFollowing(true);
        }

        const [userPlans, count] = await Promise.all([
          listUserRelatedPlans({ userId: id, limit: 50 }),
          getFollowerCount(id),
        ]);
        const publicPlans = userPlans.filter(
          (p) => p.visibility === "PÚBLICO" || isOwnProfile
        );
        setPlans(publicPlans);
        setFollowerCount(count);
      } catch (err) {
        console.error("[profile] Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, authLoading, isOwnProfile, myProfile]);

  const handleTabChange = async (tab: "planes" | "guardados") => {
    setActiveTab(tab);
    if (tab === "guardados" && !savedLoaded && user?.id) {
      setLoadingSaved(true);
      try {
        const saved = await listSavedPlans(user.id);
        setSavedPlans(saved);
        setSavedLoaded(true);
      } catch (err) {
        console.error("[profile] Error loading saved plans:", err);
      } finally {
        setLoadingSaved(false);
      }
    }
  };

  const handleEditClick = () => {
    if (!profileData) return;
    setEditName(profileData.nombre);
    setEditing(true);
  };

  const handleSaveName = async () => {
    if (!user?.id || !settings || !profileData) return;
    const trimmed = editName.trim();
    if (!trimmed || trimmed === profileData.nombre) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await saveUserProfileAndSettings({
        userId: user.id,
        nombre: trimmed,
        fechaNac: myProfile?.fecha_nac ?? null,
        profileImage: profileData.profile_image,
        theme: settings.theme,
        language: settings.language,
        timezone: settings.timezone,
        notifyPush: settings.notify_push,
        notifyEmail: settings.notify_email,
        notifyInApp: settings.notify_in_app,
        profileVisibility: settings.profile_visibility,
        allowFriendRequests: settings.allow_friend_requests,
        googleSyncEnabled: settings.google_sync_enabled ?? false,
        googleSyncExportPlans: settings.google_sync_export_plans ?? true,
      });
      setProfileData((prev) => prev ? { ...prev, nombre: trimmed } : prev);
      await refreshProfile();
      setEditing(false);
    } catch (err) {
      console.error("[profile] Error saving name:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setUploading(true);
    try {
      const { publicUrl } = await uploadProfileImage({ userId: user.id, file });
      const url = `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
      setProfileData((prev) => prev ? { ...prev, profile_image: url } : prev);

      if (settings) {
        await saveUserProfileAndSettings({
          userId: user.id,
          nombre: profileData?.nombre ?? "",
          fechaNac: myProfile?.fecha_nac ?? null,
          profileImage: url,
          theme: settings.theme,
          language: settings.language,
          timezone: settings.timezone,
          notifyPush: settings.notify_push,
          notifyEmail: settings.notify_email,
          notifyInApp: settings.notify_in_app,
          profileVisibility: settings.profile_visibility,
          allowFriendRequests: settings.allow_friend_requests,
          googleSyncEnabled: settings.google_sync_enabled ?? false,
          googleSyncExportPlans: settings.google_sync_export_plans ?? true,
        });
      }
      await refreshProfile();
    } catch (err) {
      console.error("[profile] Error uploading image:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-dvh bg-app text-app">
        <div className="relative mx-auto min-h-dvh max-w-[1440px]">
          <AppSidebar />
          <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-6)] md:py-[var(--space-8)] md:pr-[var(--space-14)]">
            <div className="mx-auto w-full max-w-[760px]">
              <ProfileSkeleton />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-dvh bg-app text-app">
        <div className="relative mx-auto min-h-dvh max-w-[1440px]">
          <AppSidebar />
          <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-6)] md:py-[var(--space-8)] md:pr-[var(--space-14)]">
            <div className="mx-auto w-full max-w-[760px]">
              <p className="py-[var(--space-10)] text-center text-body text-muted">Usuario no encontrado.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const avatarLabel = (profileData.nombre.trim()[0] || "U").toUpperCase();

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />

        <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-6)] md:py-[var(--space-8)] md:pr-[var(--space-14)]">
          <div className="mx-auto w-full max-w-[760px]">
            {/* Settings button - own profile only */}
            {isOwnProfile && (
              <div className="mb-[var(--space-4)] flex justify-end">
                <button
                  type="button"
                  onClick={() => router.push("/settings")}
                  aria-label="Ajustes"
                  className="flex items-center justify-center rounded-full p-2 text-app transition-opacity hover:opacity-70"
                >
                  <SettingsIcon className="size-[20px]" />
                </button>
              </div>
            )}

            {/* Profile header */}
            <div className="flex flex-col items-center">
              {/* Avatar with edit button */}
              <div className="relative">
                {profileData.profile_image ? (
                  <Image
                    src={profileData.profile_image}
                    alt={profileData.nombre}
                    width={96}
                    height={96}
                    className={`size-[96px] rounded-full border-2 border-app object-cover ${uploading ? "opacity-50" : ""}`}
                    referrerPolicy="no-referrer"
                    unoptimized
                  />
                ) : (
                  <div className={`flex size-[96px] items-center justify-center rounded-full bg-[var(--text-primary)] text-[32px] font-[var(--fw-semibold)] text-contrast-token ${uploading ? "opacity-50" : ""}`}>
                    {avatarLabel}
                  </div>
                )}

                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white/90 transition-opacity hover:bg-black/50 disabled:opacity-50"
                    aria-label="Cambiar foto de perfil"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="size-[28px]" aria-hidden="true">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </button>
                )}

                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="size-[20px] animate-spin rounded-full border-2 border-[var(--text-primary)] border-t-transparent" />
                  </div>
                )}
              </div>

              {/* Name - editable on own profile */}
              {editing ? (
                <div className="mt-[var(--space-3)] flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditing(false); }}
                    autoFocus
                    className="border-b border-app bg-transparent text-center [font-family:var(--font-display-face)] text-[24px] leading-[1.1] font-normal outline-none md:text-[28px]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={saving}
                    className="text-body-sm font-[var(--fw-medium)] text-[var(--primary)] transition-opacity hover:opacity-70 disabled:opacity-50"
                  >
                    {saving ? "..." : "Guardar"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={isOwnProfile ? handleEditClick : undefined}
                  className={`mt-[var(--space-3)] [font-family:var(--font-display-face)] text-[24px] leading-[1.1] font-normal md:text-[28px] ${isOwnProfile ? "cursor-pointer transition-opacity hover:opacity-70" : ""}`}
                  disabled={!isOwnProfile}
                >
                  {profileData.nombre}
                </button>
              )}

              {/* Description */}
              <p className="mt-[var(--space-1)] text-body-sm text-muted">
                {isOwnProfile
                  ? (myProfile?.username ? `@${myProfile.username}` : "Tu perfil")
                  : `Perfil de ${profileData.nombre}`}
              </p>

              {/* Follow + Add friend buttons - other profiles only */}
              {!isOwnProfile && user && (
                <div className="mt-[var(--space-3)] flex gap-[var(--space-2)]">
                  <button
                    type="button"
                    onClick={onFollowPress}
                    disabled={followLoading}
                    className={`rounded-full px-6 py-[6px] text-body-sm font-[var(--fw-semibold)] transition-all disabled:opacity-50 ${
                      following
                        ? "border border-app bg-transparent text-app hover:border-red-400 hover:text-red-400"
                        : "bg-[var(--text-primary)] text-contrast-token hover:opacity-80"
                    }`}
                  >
                    {following ? "Siguiendo" : "Seguir"}
                  </button>
                  <button
                    type="button"
                    onClick={onFriendButtonPress}
                    disabled={friendshipStatus === "pending" || sendingFriendRequest}
                    className={`rounded-full border px-6 py-[6px] text-body-sm font-[var(--fw-semibold)] transition-all disabled:opacity-50 ${
                      friendshipStatus === "friends"
                        ? "border-app bg-transparent text-app hover:border-red-400 hover:text-red-400"
                        : "border-app bg-transparent text-app hover:bg-surface"
                    }`}
                  >
                    {sendingFriendRequest ? "..." : friendshipStatus === "friends" ? "Amigos" : friendshipStatus === "pending" ? "Pendiente" : "Añadir amigo"}
                  </button>
                </div>
              )}

              {/* Stats */}
              <div className="mt-[var(--space-5)] flex gap-[var(--space-8)]">
                <div className="flex flex-col items-center">
                  <span className="text-[18px] font-[600] leading-[1.2]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
                    {plans.length}
                  </span>
                  <span className="text-body-sm text-muted">Planes</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[18px] font-[600] leading-[1.2]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
                    {followerCount}
                  </span>
                  <span className="text-body-sm text-muted">Seguidores</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[18px] font-[600] leading-[1.2]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
                    0
                  </span>
                  <span className="text-body-sm text-muted">Paises</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-[var(--space-6)]">
              <div className="relative flex">
                <button
                  type="button"
                  onClick={() => handleTabChange("planes")}
                  aria-label="Planes"
                  className={`flex-1 flex items-center justify-center py-[var(--space-3)] transition-colors duration-200 ${
                    activeTab === "planes" ? "text-app" : "text-muted hover:text-app"
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="size-[20px]" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => handleTabChange("guardados")}
                    aria-label="Guardados"
                    className={`flex-1 flex items-center justify-center py-[var(--space-3)] transition-colors duration-200 ${
                      activeTab === "guardados" ? "text-app" : "text-muted hover:text-app"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="size-[20px]" aria-hidden="true">
                      <path d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
                <span
                  className="absolute bottom-0 h-[2px] w-[28px] rounded-full bg-[var(--text-primary)] transition-all duration-300 ease-[var(--ease-standard)]"
                  style={{
                    left: activeTab === "planes"
                      ? "calc(25% - 14px)"
                      : isOwnProfile ? "calc(75% - 14px)" : "calc(50% - 14px)",
                  }}
                />
              </div>
              <div className="border-b border-app" />
            </div>

            {/* Grid */}
            <div className="mt-[var(--space-5)]">
              {activeTab === "planes" ? (
                plans.length === 0 ? (
                  <p className="py-[var(--space-6)] text-center text-body-sm text-muted">
                    {isOwnProfile ? "Aun no tienes planes publicados." : "No hay planes publicos."}
                  </p>
                ) : (
                  <PlanGrid plans={plans} onPlanClick={(planId) => router.push(`/plans/${planId}`)} />
                )
              ) : loadingSaved ? (
                <div className="py-[var(--space-6)] flex justify-center">
                  <div className="size-[20px] animate-spin rounded-full border-2 border-[var(--text-primary)] border-t-transparent" />
                </div>
              ) : savedPlans.length === 0 ? (
                <p className="py-[var(--space-6)] text-center text-body-sm text-muted">
                  Aun no has guardado ningun plan.
                </p>
              ) : (
                <PlanGrid plans={savedPlans} onPlanClick={(planId) => router.push(`/plans/${planId}`)} />
              )}
            </div>
          </div>
        </main>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
          aria-hidden="true"
        />

        {/* Unfriend dialog */}
        {showUnfriendDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4" onClick={() => setShowUnfriendDialog(false)}>
            <div className="w-full max-w-[320px] rounded-card bg-[var(--bg)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <p className="text-center text-body font-[var(--fw-semibold)]">
                ¿Eliminar a {profileData.nombre} como amigo?
              </p>
              <p className="mt-2 text-center text-body-sm text-muted">
                Dejareis de ser amigos.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUnfriendDialog(false)}
                  className="flex-1 rounded-full border border-app py-2 text-body-sm font-[var(--fw-semibold)] transition-colors hover:bg-surface"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFriend}
                  className="flex-1 rounded-full bg-red-500 py-2 text-body-sm font-[var(--fw-semibold)] text-white transition-opacity hover:opacity-80"
                >
                  Eliminar amigo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unfollow dialog */}
        {showUnfollowDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4" onClick={() => setShowUnfollowDialog(false)}>
            <div className="w-full max-w-[320px] rounded-card bg-[var(--bg)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <p className="text-center text-body font-[var(--fw-semibold)]">
                ¿Dejar de seguir a {profileData.nombre}?
              </p>
              <p className="mt-2 text-center text-body-sm text-muted">
                Dejarás de ver sus publicaciones en tu feed.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUnfollowDialog(false)}
                  className="flex-1 rounded-full border border-app py-2 text-body-sm font-[var(--fw-semibold)] transition-colors hover:bg-surface"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUnfollow}
                  className="flex-1 rounded-full bg-red-500 py-2 text-body-sm font-[var(--fw-semibold)] text-white transition-opacity hover:opacity-80"
                >
                  Dejar de seguir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanGrid({ plans, onPlanClick }: { plans: FeedPlanItemDto[]; onPlanClick?: (id: number) => void }) {
  return (
    <div className="columns-2 gap-[6px] sm:columns-3">
      {plans.map((plan) => (
        <div key={plan.id} className="mb-[6px] break-inside-avoid">
          <div
            className="group relative cursor-pointer overflow-hidden rounded-[6px]"
            onClick={() => onPlanClick?.(plan.id)}
          >
            {plan.coverImage && (
              <Image
                src={plan.coverImage}
                alt={plan.title}
                width={760}
                height={570}
                className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                unoptimized
              />
            )}
            {!plan.coverImage && <div className="aspect-[4/3] w-full bg-black" />}
            {new Date(plan.endsAt) < new Date() && (
              <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-[3px] text-[14px] font-[var(--fw-medium)] leading-tight text-white/90 backdrop-blur-sm">
                Finalizado
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-6">
              <p className="text-body-sm font-[var(--fw-medium)] leading-tight text-white">
                {plan.title}
              </p>
              {plan.locationName && (
                <p className="mt-[2px] text-[14px] leading-tight text-white/70">
                  {plan.locationName}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center" aria-label="Cargando perfil" role="status">
      {/* Avatar */}
      <div className="skeleton-shimmer size-[96px] rounded-full" />
      {/* Name */}
      <div className="skeleton-shimmer mt-[var(--space-3)] h-5 w-[140px] rounded-full" />
      {/* Subtitle */}
      <div className="skeleton-shimmer mt-[var(--space-2)] h-3 w-[90px] rounded-full" />
      {/* Stats */}
      <div className="mt-[var(--space-5)] flex gap-[var(--space-8)]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-[6px]">
            <div className="skeleton-shimmer h-5 w-[28px] rounded-full" />
            <div className="skeleton-shimmer h-3 w-[50px] rounded-full" />
          </div>
        ))}
      </div>
      {/* Divider */}
      <div className="skeleton-shimmer mt-[var(--space-6)] h-[1px] w-full" />
      {/* Grid */}
      <div className="mt-[var(--space-5)] w-full columns-2 gap-[var(--space-3)] sm:columns-3">
        {[120, 160, 130, 150, 140, 170].map((h, i) => (
          <div key={i} className="mb-[var(--space-3)] break-inside-avoid">
            <div className="skeleton-shimmer w-full rounded-[12px]" style={{ height: `${h}px` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
