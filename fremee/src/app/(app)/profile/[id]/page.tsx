"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";
import { getPublicUserProfile } from "@/services/api/repositories/users.repository";
import { listUserRelatedPlans } from "@/services/api/repositories/plans.repository";
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
  const [loading, setLoading] = useState(true);

  // Follow state (local only — will connect to DB later)
  const [following, setFollowing] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;

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

        const userPlans = await listUserRelatedPlans({ userId: id, limit: 50 });
        const publicPlans = userPlans.filter(
          (p) => p.visibility === "PUBLICO" || p.visibility === "PÚBLICO" || isOwnProfile
        );
        setPlans(publicPlans);
      } catch (err) {
        console.error("[profile] Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, isOwnProfile, myProfile]);

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
          <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] md:py-[var(--space-8)] md:pr-[var(--space-14)]">
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
          <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] md:py-[var(--space-8)] md:pr-[var(--space-14)]">
            <div className="mx-auto w-full max-w-[760px]">
              <p className="py-[var(--space-10)] text-center text-body text-muted">Usuario no encontrado.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const avatarLabel = (profileData.nombre.trim()[0] || "U").toUpperCase();
  const finishedPlans = plans.filter((p) => new Date(p.endsAt) < new Date());
  const plansWithCover = plans.filter((p) => p.coverImage);

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />

        <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] md:py-[var(--space-8)] md:pr-[var(--space-14)]">
          <div className="mx-auto w-full max-w-[760px]">
            {/* Settings button - own profile only */}
            {isOwnProfile && (
              <div className="mb-[var(--space-4)] flex justify-end">
                <button
                  type="button"
                  onClick={() => router.push("/settings")}
                  className="flex items-center gap-[var(--space-2)] rounded-card px-3 py-[6px] text-body-sm text-muted transition-colors hover:bg-surface hover:text-app"
                >
                  <SettingsIcon className="size-[18px]" />
                  <span>Ajustes</span>
                </button>
              </div>
            )}

            {/* Profile header */}
            <div className="flex flex-col items-center">
              {/* Avatar with edit button */}
              <div className="relative">
                {profileData.profile_image ? (
                  <img
                    src={profileData.profile_image}
                    alt={profileData.nombre}
                    className={`size-[96px] rounded-full border-2 border-app object-cover ${uploading ? "opacity-50" : ""}`}
                    referrerPolicy="no-referrer"
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
                    className="absolute -bottom-1 -right-1 flex size-[30px] items-center justify-center rounded-full border-2 border-[var(--bg)] bg-[var(--text-primary)] text-contrast-token transition-opacity hover:opacity-80 disabled:opacity-50"
                    aria-label="Cambiar foto de perfil"
                  >
                    <PencilIcon className="size-[14px]" />
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
                    className="border-b border-app bg-transparent text-center text-[var(--font-h4)] font-[var(--fw-semibold)] leading-[var(--lh-h4)] outline-none"
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
                  className={`mt-[var(--space-3)] text-[var(--font-h4)] font-[var(--fw-semibold)] leading-[var(--lh-h4)] ${isOwnProfile ? "cursor-pointer transition-opacity hover:opacity-70" : ""}`}
                  disabled={!isOwnProfile}
                >
                  {profileData.nombre}
                </button>
              )}

              {/* Description */}
              <p className="mt-[var(--space-1)] text-body-sm text-muted">
                {isOwnProfile ? "Tu perfil" : `Perfil de ${profileData.nombre}`}
              </p>

              {/* Follow button - other profiles only */}
              {!isOwnProfile && user && (
                <button
                  type="button"
                  onClick={() => setFollowing((prev) => !prev)}
                  className={`mt-[var(--space-3)] rounded-full px-6 py-[6px] text-body-sm font-[var(--fw-semibold)] transition-all ${
                    following
                      ? "border border-app bg-transparent text-app hover:border-red-400 hover:text-red-400"
                      : "bg-[var(--text-primary)] text-contrast-token hover:opacity-80"
                  }`}
                >
                  {following ? "Siguiendo" : "Seguir"}
                </button>
              )}

              {/* Stats */}
              <div className="mt-[var(--space-5)] flex gap-[var(--space-8)]">
                <div className="flex flex-col items-center">
                  <span className="text-[var(--font-h5)] font-[var(--fw-semibold)] leading-[var(--lh-h5)]">
                    {finishedPlans.length}
                  </span>
                  <span className="text-body-sm text-muted">Planes</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[var(--font-h5)] font-[var(--fw-semibold)] leading-[var(--lh-h5)]">
                    0
                  </span>
                  <span className="text-body-sm text-muted">Seguidores</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[var(--font-h5)] font-[var(--fw-semibold)] leading-[var(--lh-h5)]">
                    0
                  </span>
                  <span className="text-body-sm text-muted">Paises</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="mt-[var(--space-6)] border-t border-app" />

            {/* Masonry grid of plans */}
            <div className="mt-[var(--space-5)]">
              {plansWithCover.length === 0 ? (
                <p className="py-[var(--space-6)] text-center text-body-sm text-muted">
                  {isOwnProfile ? "Aun no tienes planes publicados." : "No hay planes publicos."}
                </p>
              ) : (
                <div className="columns-2 gap-[var(--space-3)] sm:columns-3">
                  {plansWithCover.map((plan) => (
                    <div key={plan.id} className="mb-[var(--space-3)] break-inside-avoid">
                      <div className="group relative overflow-hidden rounded-[12px]">
                        <img
                          src={plan.coverImage!}
                          alt={plan.title}
                          className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-6">
                          <p className="text-body-sm font-[var(--fw-medium)] leading-tight text-white">
                            {plan.title}
                          </p>
                          {plan.locationName && (
                            <p className="mt-[2px] text-[11px] leading-tight text-white/70">
                              {plan.locationName}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
      </div>
    </div>
  );
}

function SettingsIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 1v2.5M12 20.5V23M23 12h-2.5M3.5 12H1M20.07 3.93l-1.77 1.77M5.7 18.3l-1.77 1.77M20.07 20.07l-1.77-1.77M5.7 5.7L3.93 3.93"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center" aria-label="Cargando perfil" role="status">
      {/* Avatar */}
      <div className="feed-skeleton-shimmer size-[96px] rounded-full" />
      {/* Name */}
      <div className="feed-skeleton-shimmer mt-[var(--space-3)] h-5 w-[140px] rounded-full" />
      {/* Subtitle */}
      <div className="feed-skeleton-shimmer mt-[var(--space-2)] h-3 w-[90px] rounded-full" />
      {/* Stats */}
      <div className="mt-[var(--space-5)] flex gap-[var(--space-8)]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-[6px]">
            <div className="feed-skeleton-shimmer h-5 w-[28px] rounded-full" />
            <div className="feed-skeleton-shimmer h-3 w-[50px] rounded-full" />
          </div>
        ))}
      </div>
      {/* Divider */}
      <div className="feed-skeleton-shimmer mt-[var(--space-6)] h-[1px] w-full" />
      {/* Grid */}
      <div className="mt-[var(--space-5)] w-full columns-2 gap-[var(--space-3)] sm:columns-3">
        {[120, 160, 130, 150, 140, 170].map((h, i) => (
          <div key={i} className="mb-[var(--space-3)] break-inside-avoid">
            <div className="feed-skeleton-shimmer w-full rounded-[12px]" style={{ height: `${h}px` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PencilIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M16.474 5.408l2.118 2.118m-.756-3.982L12.109 9.27a2.118 2.118 0 0 0-.58 1.082L11 13l2.648-.53a2.118 2.118 0 0 0 1.082-.58l5.727-5.727a1.853 1.853 0 1 0-2.621-2.621z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
