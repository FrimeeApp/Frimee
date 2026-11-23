"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import { useAuth } from "@/providers/AuthProvider";
import { getPublicUserProfile } from "@/services/api/repositories/users.repository";
import { cancelFriendRequest, removeFriend, sendFriendRequest } from "@/services/api/endpoints/users.endpoint";
import { acceptFriendRequest } from "@/services/api/repositories/notifications.repository";
import { getOrCreateDirectoChat } from "@/services/api/repositories/chat.repository";
import { getPerfilAjeno, type PerfilAjeno } from "@/services/api/endpoints/perfilAjeno.endpoint";
import { leerPasaporte } from "@/services/api/endpoints/pasaporte.endpoint";
import type { Sello } from "@/lib/passport";
import { useBloqueos } from "@/hooks/useBloqueos";
import { BlockConfirm } from "@/components/chat/info/BlockConfirm";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import MiPerfil, { PassportLoadingCard } from "@/components/profile/passport/MiPerfil";
import OtherProfile from "@/components/profile/other/OtherProfile";
import InviteToPlanSheet from "@/components/profile/other/InviteToPlanSheet";
import { useToast } from "@/components/ui/Toaster";

type ProfileData = {
  id: string;
  nombre: string;
  profile_image: string | null;
};

const SHELL = "px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-mobile-safe-top md:py-[var(--space-8)] md:pr-[var(--space-14)]";

/** Tu perfil (pasaporte y cartera) o el de otra persona (pasaporte según su privacidad y «En común»). */
export default function ProfilePage() {
  const { id: routeId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const routeProfileId = routeId === "static" ? searchParams.get("id") ?? "" : routeId;
  // Si encima se abre otra ruta (p. ej. «Ver el plan» como ventana), esta pantalla sigue montada y useParams
  // pasa a devolver el id de la otra ruta: solo se actualiza el id mientras la ruta sea de perfil.
  const [id, setId] = useState(routeProfileId);
  if (pathname.startsWith("/profile") && routeProfileId !== id) setId(routeProfileId);
  const { user, profile: myProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const isGuest = Boolean(user?.is_anonymous);
  const isOwnProfile = user?.id === id;
  const { bloqueados, bloquear, desbloquear } = useBloqueos();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [perfil, setPerfil] = useState<PerfilAjeno | null>(null);
  const [sellos, setSellos] = useState<Sello[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const [showUnfriendDialog, setShowUnfriendDialog] = useState(false);
  const { isClosing: unfriendClosing, requestClose: closeUnfriendDialog } = useModalCloseAnimation(() => setShowUnfriendDialog(false), showUnfriendDialog);
  const [showBlock, setShowBlock] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    if (!id || authLoading || isOwnProfile) return;
    let cancelled = false;
    const load = async () => {
      try {
        // La relación, el acceso al pasaporte y lo que tenéis en común los resuelve el servidor.
        const [profileResult, perfilResult] = await Promise.all([getPublicUserProfile(id), getPerfilAjeno(id)]);
        if (cancelled) return;
        setProfileData(profileResult);
        setPerfil(perfilResult);
        if (profileResult && perfilResult.acceso_pasaporte === "visible") {
          const leido = await leerPasaporte(id).catch((err) => {
            console.error("[perfil] Error leyendo el pasaporte:", (err as { message?: string } | null)?.message ?? err);
            return null;
          });
          if (!cancelled) setSellos(leido?.puede_ver ? leido.sellos : []);
        } else {
          setSellos([]);
        }
      } catch (err) {
        const { message, code } = (err ?? {}) as { message?: string; code?: string };
        console.error("[perfil] Error cargando el perfil:", message ?? err, code ?? "");
        if (!cancelled) {
          setProfileData(null);
          setPerfil(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, authLoading, isOwnProfile, attempt]);

  if (isOwnProfile && !authLoading) {
    return (
      <div className="min-h-dvh bg-app text-app">
        <div className="relative mx-auto min-h-dvh max-w-[1440px]">
          <AppSidebar />
          <main className={SHELL}>
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

  const shell = (children: React.ReactNode) => (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />
        <main className={SHELL}>{children}</main>
      </div>
    </div>
  );

  if (authLoading || loading) return shell(<ProfileSkeleton />);
  if (!profileData || !perfil) {
    return shell(<p className="py-[var(--space-10)] text-center text-body text-muted">Usuario no encontrado.</p>);
  }

  const nombre = profileData.nombre;
  const firstName = nombre.trim().split(/\s+/)[0] ?? nombre;
  const guestBlock = () => {
    if (isGuest) {
      toast("Regístrate para hacerlo", "info");
      return true;
    }
    return false;
  };
  const mapErr = (err: unknown) => {
    const msg = err instanceof Error ? err.message : (err as { message?: string } | null)?.message ?? "";
    if (msg.startsWith("Regístrate")) {
      toast("Regístrate para hacerlo", "info");
      return;
    }
    throw err;
  };

  return shell(
    <>
      <OtherProfile
        data={{
          id,
          fullName: nombre,
          firstName,
          avatarUrl: profileData.profile_image,
          relationship: perfil.relacion,
          access: perfil.acceso_pasaporte,
          sellos,
          common: perfil.en_comun,
          juntosIds: perfil.juntos_plan_ids,
        }}
        blocked={bloqueados.has(id)}
        backHref="/search"
        onMessage={async () => {
          if (guestBlock()) return;
          try {
            const chatId = await getOrCreateDirectoChat(id);
            router.push(`/messages?chat=${encodeURIComponent(chatId)}`);
          } catch (err) {
            mapErr(err);
          }
        }}
        onInvite={() => {
          if (!guestBlock()) setShowInvite(true);
        }}
        onAddFriend={async () => {
          if (guestBlock()) return;
          try {
            await sendFriendRequest(id);
            setPerfil((p) => (p ? { ...p, relacion: "request_sent" } : p));
          } catch (err) {
            mapErr(err);
          }
        }}
        onAcceptFriend={async () => {
          await acceptFriendRequest(id);
          // Ya sois amistad: puede que ahora veas su pasaporte y lo que tenéis en común.
          reload();
        }}
        onCancelRequest={async () => {
          await cancelFriendRequest(id);
          setPerfil((p) => (p ? { ...p, relacion: "none" } : p));
        }}
        onRemoveFriend={() => setShowUnfriendDialog(true)}
        onBlock={() => setShowBlock(true)}
        onUnblock={async () => {
          try {
            await desbloquear(id);
            reload();
          } catch (err) {
            console.error("[perfil] Error desbloqueando:", (err as { message?: string } | null)?.message ?? err);
            toast("No se ha desbloqueado. Inténtalo de nuevo.", "error");
          }
        }}
      />

      {showInvite && user && <InviteToPlanSheet myId={user.id} userId={id} firstName={firstName} onClose={() => setShowInvite(false)} />}

      {showBlock && (
        <BlockConfirm
          name={firstName}
          onClose={() => setShowBlock(false)}
          onConfirm={async () => {
            await bloquear(id);
            setShowBlock(false);
            reload();
          }}
        />
      )}

      {showUnfriendDialog && (
        <div data-closing={unfriendClosing ? "true" : "false"} className="app-modal-overlay fixed inset-0 z-[200] flex items-center justify-center px-4" onClick={closeUnfriendDialog}>
          <div className="app-modal-panel w-full max-w-[320px] rounded-card bg-[var(--bg)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-body font-[var(--fw-semibold)]">¿Quitar a {nombre} de tus amistades?</p>
            <p className="mt-2 text-center text-body-sm text-muted">Dejaréis de ser amistad y no veréis vuestros pasaportes.</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={closeUnfriendDialog} className="flex-1 rounded-full border border-app py-2 text-body-sm font-[var(--fw-semibold)] transition-colors hover:bg-surface">
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  closeUnfriendDialog();
                  try {
                    await removeFriend(id);
                    reload();
                  } catch (err) {
                    console.error("[perfil] Error quitando la amistad:", (err as { message?: string } | null)?.message ?? err);
                    toast("No se pudo quitar la amistad. Inténtalo de nuevo.", "error");
                  }
                }}
                className="flex-1 rounded-full bg-red-500 py-2 text-body-sm font-[var(--fw-semibold)] text-white transition-opacity hover:opacity-80"
              >
                Quitar amistad
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
  );
}

/** Cabecera y tarjeta del pasaporte cargando: misma forma que tu perfil, para que no cambie al llegar los datos. */
function ProfileSkeleton() {
  return (
    <div aria-label="Cargando perfil" role="status" className="mx-auto flex w-full max-w-[1080px] flex-col gap-5 md:gap-6">
      <div className="flex items-center gap-4 md:gap-6">
        <div className="skeleton-shimmer size-[72px] shrink-0 rounded-full md:size-[104px]" />
        <div className="flex flex-col gap-2">
          <div className="skeleton-shimmer h-3 w-20 rounded-full" />
          <div className="skeleton-shimmer h-8 w-48 rounded-full md:h-12 md:w-72" />
        </div>
      </div>
      <PassportLoadingCard />
    </div>
  );
}
