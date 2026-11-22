"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import AppSidebar from "@/components/common/AppSidebar";
import { useAuth } from "@/providers/AuthProvider";
import { getPublicUserProfile } from "@/services/api/repositories/users.repository";
import { sendFriendRequest, getFriendshipStatuses, getFollowStatuses, removeFriend, getFollowerCount } from "@/services/api/endpoints/users.endpoint";
import { useFollow } from "@/hooks/useFollow";
import { listUserRelatedPlans } from "@/services/api/repositories/plans.repository";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { Ban, MoreHorizontal } from "lucide-react";
import { useBloqueos } from "@/hooks/useBloqueos";
import { BlockConfirm } from "@/components/chat/info/BlockConfirm";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import MiPerfil from "@/components/profile/passport/MiPerfil";
import { useToast } from "@/components/ui/Toaster";

/** Seguir is hidden while the feed is (its code and data stay for when the feed comes back). */
const MOSTRAR_SEGUIR = false;

type ProfileData = {
  id: string;
  nombre: string;
  profile_image: string | null;
};

export default function ProfilePage() {
  const { id: routeId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = routeId === "static" ? searchParams.get("id") ?? "" : routeId;
  const { user, profile: myProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const isGuest = Boolean(user?.is_anonymous);
  const isOwnProfile = user?.id === id;

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [plans, setPlans] = useState<FeedPlanItemDto[]>([]);
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
  const { isClosing: unfriendClosing, requestClose: closeUnfriendDialog } = useModalCloseAnimation(() => setShowUnfriendDialog(false), showUnfriendDialog);
  const { isClosing: unfollowClosing, requestClose: closeUnfollowDialog } = useModalCloseAnimation(() => setShowUnfollowDialog(false), showUnfollowDialog);

  const handleAddFriend = async () => {
    if (friendshipStatus !== "none" || sendingFriendRequest) return;
    if (isGuest) { toast("Regístrate para hacerlo", "info"); return; }
    setSendingFriendRequest(true);
    try {
      await sendFriendRequest(id);
      setFriendshipStatus("pending");
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string } | null)?.message ?? "";
      if (msg.startsWith("Regístrate")) toast("Regístrate para hacerlo", "info");
      else console.error("[profile] Error sending friend request:", err);
    } finally {
      setSendingFriendRequest(false);
    }
  };

  const handleRemoveFriend = async () => {
    closeUnfriendDialog();
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

  useEffect(() => {
    if (!id || authLoading || isOwnProfile) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setProfileData(null);
      setPlans([]);
      setFollowerCount(0);
      setFriendshipStatus("none");
      setInitialFollowing(false);
      try {
        const profileResult: ProfileData | null = await getPublicUserProfile(id);

        if (cancelled) return;
        setProfileData(profileResult);
        if (!profileResult) return;

        if (!isOwnProfile) {
          const [friendStatusesResult, followStatusesResult] = await Promise.allSettled([
            getFriendshipStatuses([id]),
            getFollowStatuses([id]),
          ]);
          if (cancelled) return;
          if (friendStatusesResult.status === "fulfilled") {
            setFriendshipStatus(friendStatusesResult.value[id] ?? "none");
          }
          if (followStatusesResult.status === "fulfilled") {
            setInitialFollowing(Boolean(followStatusesResult.value[id]));
          }
        }

        const [userPlansResult, followerCountResult] = await Promise.allSettled([
          listUserRelatedPlans({ userId: id, limit: 50 }),
          getFollowerCount(id),
        ]);
        if (cancelled) return;
        if (userPlansResult.status === "fulfilled") {
          const publicPlans = userPlansResult.value.filter((p) => p.visibility === "PÚBLICO");
          setPlans(publicPlans);
        }
        if (followerCountResult.status === "fulfilled") {
          setFollowerCount(followerCountResult.value);
        }
      } catch (err) {
        // Supabase errors are Error instances: logged as-is they show up as "{}".
        const { message, code, details } = (err ?? {}) as { message?: string; code?: string; details?: string };
        console.error("[profile] Error loading profile:", message ?? err, code ?? "", details ?? "");
        if (!cancelled) {
          setProfileData(null);
          setPlans([]);
          setFollowerCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, authLoading, isOwnProfile]);

  if (isOwnProfile && !authLoading) {
    return (
      <div className="min-h-dvh bg-app text-app">
        <div className="relative mx-auto min-h-dvh max-w-[1440px]">
          <AppSidebar />
          <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-mobile-safe-top md:py-[var(--space-8)] md:pr-[var(--space-14)]">
            {myProfile ? (
              <MiPerfil userId={myProfile.id} nombre={myProfile.nombre} profileImage={myProfile.profile_image} isGuest={isGuest} />
            ) : (
              <p role="alert" className="py-[var(--space-10)] text-center text-body text-muted">No se pudo cargar tu perfil.</p>
            )}
          </main>
        </div>
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-dvh bg-app text-app">
        <div className="relative mx-auto min-h-dvh max-w-[1440px]">
          <AppSidebar />
          <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-mobile-safe-top md:py-[var(--space-8)] md:pr-[var(--space-14)]">
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
          <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-mobile-safe-top md:py-[var(--space-8)] md:pr-[var(--space-14)]">
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

        <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-mobile-safe-top md:py-[var(--space-8)] md:pr-[var(--space-14)]">
          <div className="mx-auto w-full max-w-[760px]">
            {/* Profile header */}
            <div className="flex flex-col items-center">
              <div className="relative">
                {profileData.profile_image ? (
                  <Image
                    src={profileData.profile_image}
                    alt={profileData.nombre}
                    width={96}
                    height={96}
                    className="size-[96px] rounded-full border-2 border-app object-cover"
                    unoptimized
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex size-[96px] items-center justify-center rounded-full bg-[var(--text-primary)] text-[32px] font-[var(--fw-semibold)] text-contrast-token">
                    {avatarLabel}
                  </div>
                )}
              </div>

              <p className="mt-[var(--space-3)] [font-family:var(--font-display-face)] text-[24px] leading-[1.1] font-normal md:text-[28px]">
                {profileData.nombre}
              </p>

              {/* Description */}
              <p className="mt-[var(--space-1)] text-body-sm text-muted">
                {`Perfil de ${profileData.nombre}`}
              </p>

              {/* Follow + Add friend buttons - other profiles only */}
              {user && (
                <div className="mt-[var(--space-3)] flex gap-[var(--space-2)]">
                  {MOSTRAR_SEGUIR && (
                  <button
                    type="button"
                    onClick={onFollowPress}
                    disabled={followLoading}
                    className={`rounded-full px-6 py-[6px] text-body-sm font-[var(--fw-semibold)] transition-all disabled:opacity-50 ${
                      following
                        ? "border border-transparent bg-primary-token text-[var(--contrast)] hover:opacity-80 md:hover:bg-red-500 md:hover:text-white"
                        : "border border-app bg-transparent text-app hover:bg-surface"
                    }`}
                  >
                    {following ? "Siguiendo" : "Seguir"}
                  </button>
                  )}
                  <button
                    type="button"
                    onClick={onFriendButtonPress}
                    disabled={friendshipStatus === "pending" || sendingFriendRequest}
                    className={`rounded-full border px-6 py-[6px] text-body-sm font-[var(--fw-semibold)] transition-all disabled:opacity-50 ${
                      isGuest ? "opacity-60 " : ""
                    }${
                      friendshipStatus === "friends"
                        ? "border-app bg-transparent text-app hover:border-red-400 hover:text-red-400"
                        : "border-app bg-transparent text-app hover:bg-surface"
                    }`}
                  >
                    {sendingFriendRequest ? "..." : friendshipStatus === "friends" ? "Amigos" : friendshipStatus === "pending" ? "Pendiente" : "Añadir amigo"}
                  </button>
                  {!isGuest && <ProfileMoreMenu userId={profileData.id} name={profileData.nombre} />}
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
                {MOSTRAR_SEGUIR && (
                <div className="flex flex-col items-center">
                  <span className="text-[18px] font-[600] leading-[1.2]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
                    {followerCount}
                  </span>
                  <span className="text-body-sm text-muted">Seguidores</span>
                </div>
                )}
                <div className="flex flex-col items-center">
                  <span className="text-[18px] font-[600] leading-[1.2]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
                    0
                  </span>
                  <span className="text-body-sm text-muted">Países</span>
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="mt-[var(--space-6)]">
              {plans.length === 0 ? (
                <p className="py-[var(--space-6)] text-center text-body-sm text-muted">No hay planes públicos.</p>
              ) : (
                <PlanGrid plans={plans} onPlanClick={(planId) => router.push(Capacitor.isNativePlatform() ? `/plans/static?id=${planId}` : `/plans/${planId}`)} />
              )}
            </div>
          </div>
        </main>

        {/* Unfriend dialog */}
        {showUnfriendDialog && (
          <div data-closing={unfriendClosing ? "true" : "false"} className="app-modal-overlay fixed inset-0 z-[200] flex items-center justify-center px-4" onClick={closeUnfriendDialog}>
            <div className="app-modal-panel w-full max-w-[320px] rounded-card bg-[var(--bg)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <p className="text-center text-body font-[var(--fw-semibold)]">
                ¿Eliminar a {profileData.nombre} como amigo?
              </p>
              <p className="mt-2 text-center text-body-sm text-muted">
                Dejareis de ser amigos.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={closeUnfriendDialog}
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
          <div data-closing={unfollowClosing ? "true" : "false"} className="app-modal-overlay fixed inset-0 z-[200] flex items-center justify-center px-4" onClick={closeUnfollowDialog}>
            <div className="app-modal-panel w-full max-w-[320px] rounded-card bg-[var(--bg)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <p className="text-center text-body font-[var(--fw-semibold)]">
                ¿Dejar de seguir a {profileData.nombre}?
              </p>
              <p className="mt-2 text-center text-body-sm text-muted">
                Dejarás de ver sus publicaciones.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={closeUnfollowDialog}
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
    <div className="grid grid-cols-3 gap-[4px] sm:gap-[6px]">
      {plans.map((plan) => (
        <button
          key={plan.id}
          type="button"
          className="group relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-[6px] bg-surface text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)]"
          onClick={() => onPlanClick?.(plan.id)}
          aria-label={plan.title}
        >
          {plan.coverImage ? (
            <Image
              src={plan.coverImage}
              alt=""
              fill
              sizes="(max-width: 767px) 33vw, 240px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1a2a4a] to-[#0d1a2e]">
              <svg viewBox="0 0 24 24" fill="none" className="size-8 text-white/20 sm:size-10" aria-hidden>
                <path d="M22 16.5H2M5 19.5h14M12 3L4.5 13.5h15L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
          {new Date(plan.endsAt) < new Date() && (
            <div className="absolute right-1.5 top-1.5 rounded-full bg-black/50 px-1.5 py-[2px] text-[10px] font-[var(--fw-medium)] leading-tight text-white/90 backdrop-blur-sm sm:right-2 sm:top-2 sm:px-2 sm:py-[3px] sm:text-[12px]">
              Finalizado
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-5 sm:px-3 sm:pb-3 sm:pt-6">
            <p className="truncate text-[11px] font-[var(--fw-medium)] leading-tight text-white sm:text-body-sm">
              {plan.title}
            </p>
            {plan.locationName && (
              <p className="mt-[2px] truncate text-[10px] leading-tight text-white/70 sm:text-[13px]">
                {plan.locationName}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-label="Cargando perfil" role="status">
      <div className="flex flex-col items-center">
        <div className="skeleton-shimmer size-[96px] rounded-full" />
        <div className="skeleton-shimmer mt-[var(--space-3)] h-5 w-[140px] rounded-full" />
        <div className="skeleton-shimmer mt-[var(--space-2)] h-3 w-[96px] rounded-full" />

        <div className="mt-[var(--space-5)] flex gap-[var(--space-8)]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-[6px]">
              <div className="skeleton-shimmer h-4 w-[28px] rounded-full" />
              <div className="skeleton-shimmer h-3 w-[48px] rounded-full opacity-70" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-[var(--space-5)] grid w-full grid-cols-3 gap-[4px] sm:gap-[6px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-shimmer aspect-[4/3] w-full rounded-[6px]" />
        ))}
      </div>
    </div>
  );
}

/** «⋯» next to the friend button: Bloquear, or Desbloquear when already blocked. */
function ProfileMoreMenu({ userId, name }: { userId: string; name: string }) {
  const { bloqueados, bloquear, desbloquear } = useBloqueos();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const blocked = bloqueados.has(userId);
  const first = name.split(" ")[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const onItem = () => {
    setOpen(false);
    setError(null);
    if (!blocked) { setConfirming(true); return; }
    desbloquear(userId).catch((e) => {
      console.error("[perfil] Error desbloqueando:", (e as { message?: string })?.message ?? String(e));
      setError("No se ha desbloqueado. Inténtalo de nuevo.");
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Más opciones"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-[36px] items-center justify-center rounded-full border border-app text-app transition-colors hover:bg-surface"
      >
        <MoreHorizontal className="size-[18px]" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute left-1/2 top-[42px] z-20 w-[200px] -translate-x-1/2 rounded-[8px] border border-app bg-[var(--bg)] p-[4px] shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
          <button type="button" role="menuitem" onClick={onItem} className="flex min-h-[44px] w-full items-center gap-[10px] rounded-[6px] px-[10px] text-left text-[15px] text-[var(--error)] hover:bg-[var(--surface-2)]">
            <Ban className="size-[18px]" aria-hidden />
            {blocked ? "Desbloquear" : "Bloquear"}
          </button>
        </div>
      )}
      {error && <p role="alert" className="absolute left-1/2 top-[42px] w-[220px] -translate-x-1/2 text-center text-[13px] text-[var(--error)]">{error}</p>}
      {confirming && (
        <BlockConfirm
          name={first}
          onClose={() => setConfirming(false)}
          onConfirm={async () => { await bloquear(userId); setConfirming(false); }}
        />
      )}
    </div>
  );
}
