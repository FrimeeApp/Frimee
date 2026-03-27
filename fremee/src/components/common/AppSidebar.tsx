"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import CreatePlanModal, { type CreatePlanPayload } from "@/components/plans/CreatePlanModal";
import { createPlan } from "@/services/api/repositories/plans.repository";
import { countNotificacionesNoLeidas, insertNotificacion } from "@/services/api/repositories/notifications.repository";
import { searchUsers, type PublicUserProfileDto } from "@/services/api/repositories/users.repository";
import NotificationsPanel from "@/components/notifications/NotificationsPanel";
type IconProps = {
  className?: string;
};

const items = [
  { key: "home", label: "Inicio", icon: HomeIcon, href: "/feed" },
  { key: "calendar", label: "Mis planes", icon: PlansIcon, href: "/calendar" },
  { key: "cards", label: "Mis gastos", icon: CardIcon, href: "/mis-gastos" },
  { key: "send", label: "Mensajes", icon: SendIcon, href: "/messages" },
];

type AppSidebarProps = {
  onCreatePlan?: () => void;
};

function dateInputToIso(dateInput: string, hour = 12) {
  const [year, month, day] = dateInput.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, hour, 0, 0).toISOString();
}

export default function AppSidebar({ onCreatePlan }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavVisible, setMobileNavVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<PublicUserProfileDto[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);

  const { user, profile } = useAuth();
  const hasProfileImage = Boolean(profile?.profile_image);

  const expanded = hovered;

  // Mobile scroll hide/show
  useEffect(() => {
    if (typeof window === "undefined") return;

    const threshold = 10;
    lastScrollYRef.current = window.scrollY;

    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;

      if (currentY <= 8) {
        setMobileNavVisible(true);
      } else if (delta > threshold) {
        setMobileNavVisible(false);
      } else if (delta < -threshold) {
        setMobileNavVisible(true);
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    void countNotificacionesNoLeidas().then(setUnreadNotifs).catch(() => setUnreadNotifs(0));
  }, []);

  useEffect(() => {
    setSearchPopoverOpen(false);
    setNotifPanelOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!searchPopoverOpen) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [searchPopoverOpen]);

  useEffect(() => {
    if (!searchPopoverOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchPopoverOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [searchPopoverOpen]);

  useEffect(() => {
    const trimmedQuery = searchValue.trim();

    if (!searchPopoverOpen || trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await searchUsers({
          query: trimmedQuery,
          limit: 6,
          excludeUserId: user?.id ?? undefined,
        });

        if (!cancelled) {
          setSearchResults(results);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchPopoverOpen, searchValue, user?.id]);

  const openProfile = () => router.push(user?.id ? `/profile/${user.id}` : "/settings");
  const openCreatePlan = () => {
    if (onCreatePlan) {
      onCreatePlan();
      return;
    }
    setCreateModalOpen(true);
  };

  const handleCreatePlan = async (payload: CreatePlanPayload) => {
    if (!user?.id) return;

    let coverUrl: string | null = null;
    if (payload.coverFile) {
      const { uploadPlanCoverFile } = await import("@/services/firebase/upload");
      const { downloadUrl } = await uploadPlanCoverFile({ file: payload.coverFile, userId: user.id });
      coverUrl = downloadUrl;
    }

    const startIso = dateInputToIso(payload.startDate, 10);
    const endIso = dateInputToIso(payload.endDate, 18);

    const created = await createPlan({
      titulo: payload.title,
      descripcion: `Plan en ${payload.location}`,
      inicioAt: startIso,
      finAt: endIso,
      ubicacionNombre: payload.location,
      fotoPortada: coverUrl,
      allDay: true,
      visibilidad: payload.visibility,
      ownerUserId: user.id,
      creadoPorUserId: user.id,
    });

    // Enviar invitaciones a los amigos seleccionados
    if (payload.invitedFriendIds.length > 0) {
      await Promise.allSettled(
        payload.invitedFriendIds.map((friendId) =>
          insertNotificacion({
            userId: friendId,
            tipo: "plan_invite",
            actorId: user.id,
            entityId: String(created.id),
            entityType: "plan",
          })
        )
      );
    }

    setCreateModalOpen(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isCapacitor = typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.();
    router.push(isCapacitor ? `/plans/static?id=${created.id}` : `/plans/${created.id}`);
  };

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  const renderSidebarRow = ({
    key,
    label,
    icon,
    href,
    onClick,
    active = false,
    badge = null,
  }: {
    key: string;
    label: string;
    icon: (props?: IconProps) => ReactNode;
    href?: string;
    onClick?: () => void;
    active?: boolean;
    badge?: string | number | null;
  }) => {
    const cls = `flex h-[24px] items-center transition-opacity duration-150 hover:opacity-70 ${active ? "text-[var(--primary)]" : "text-app"}`;
    const content = (
      <>
        <div className="relative flex w-[102px] shrink-0 items-center justify-center">
          {icon({ className: "size-[26px]" })}
          {badge ? (
            <span className="absolute top-0 right-[38px] flex size-[16px] items-center justify-center rounded-full bg-blue-500 text-[9px] font-[var(--fw-semibold)] leading-none text-white">
              {badge}
            </span>
          ) : null}
        </div>
        {expanded && <span className={`-ml-[14px] whitespace-nowrap pr-[var(--space-4)] text-body ${active ? "font-[var(--fw-semibold)]" : "font-[var(--fw-medium)]"}`}>{label}</span>}
      </>
    );

    return href ? (
      <Link key={key} href={href} aria-label={label} className={cls}>
        {content}
      </Link>
    ) : (
      <button key={key} type="button" aria-label={label} onClick={onClick} className={cls}>
        {content}
      </button>
    );
  };

  const searchActive = searchPopoverOpen || isActive("/search");

  return (
    <>
      {/* Mobile bottom nav */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-sticky flex h-[calc(var(--space-16)+env(safe-area-inset-bottom))] items-center justify-around border-t border-strong bg-app px-[var(--space-5)] pb-safe transition-transform duration-[var(--duration-slow)] [transition-timing-function:var(--ease-decelerate)] md:hidden ${
          mobileNavVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {items.slice(0, 2).map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-label={item.label}
            className={`${isActive(item.href) ? "text-[var(--primary)]" : "text-app"} transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)]`}
          >
            <item.icon className="size-[24px]" />
          </Link>
        ))}

        <button
          type="button"
          aria-label="Crear plan"
          onClick={openCreatePlan}
          className="text-app transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)]"
        >
          <PlusIcon className="size-[24px]" />
        </button>

        {items.slice(2).map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-label={item.label}
            className={`${isActive(item.href) ? "text-[var(--primary)]" : "text-app"} transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)]`}
          >
            <item.icon className="size-[24px]" />
          </Link>
        ))}

      </nav>

      {/* Desktop sidebar */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`fixed left-0 top-0 z-30 hidden h-dvh border-r border-app bg-app transition-[width] duration-200 ease-out md:flex md:flex-col md:py-[var(--space-6)] ${
          expanded ? "w-[240px]" : "w-[102px]"
        }`}
      >
        <div className="flex w-full flex-1 flex-col overflow-hidden">
          {/* Logo — icon always centered in the 102px zone */}
          <div className="flex h-[40px] w-[102px] shrink-0 items-center justify-center">
            <span className="[font-family:var(--font-display-face)] text-[var(--font-h3)] font-normal leading-[var(--lh-h3)] tracking-[0.01em] text-app">Frimee</span>
          </div>

          {/* Nav items — icon always at same position */}
          <nav className="mt-[calc(var(--space-24)+var(--space-8))] flex w-full flex-col gap-[var(--space-8)]">
            {items.map((item) =>
              renderSidebarRow({
                key: item.key,
                label: item.label,
                icon: item.icon,
                href: item.href,
                active: isActive(item.href),
              })
            )}
            <button
              type="button"
              aria-label="Buscar"
              onClick={() => {
                setNotifPanelOpen(false);
                setSearchPopoverOpen(true);
              }}
              className={`flex h-[24px] items-center transition-opacity duration-150 hover:opacity-70 ${searchActive ? "text-[var(--primary)]" : "text-app"}`}
            >
              <div className="relative flex w-[102px] shrink-0 items-center justify-center">
                <SearchIcon className="size-[26px]" />
              </div>
              {expanded && (
                <span className={`-ml-[14px] whitespace-nowrap pr-[var(--space-4)] text-body ${searchActive ? "font-[var(--fw-semibold)]" : "font-[var(--fw-medium)]"}`}>
                  Buscar
                </span>
              )}
            </button>
            {renderSidebarRow({
              key: "notifications",
              label: "Notificaciones",
              icon: BellIcon,
              onClick: () => {
                setSearchPopoverOpen(false);
                setNotifPanelOpen(true);
              },
              badge: unreadNotifs > 0 ? (unreadNotifs > 9 ? "9+" : unreadNotifs) : null,
            })}
          </nav>

          {/* Create button */}
          <button
            type="button"
            aria-label="Crear plan"
            onClick={openCreatePlan}
            className="mt-[var(--space-14)] flex h-[24px] items-center text-app transition-opacity duration-150 hover:opacity-70"
          >
            <div className="flex w-[102px] shrink-0 items-center justify-center">
              <PlusIcon className="size-[26px]" />
            </div>
            {expanded && <span className="-ml-[14px] whitespace-nowrap pr-[var(--space-4)] text-body font-[var(--fw-medium)]">Crear plan</span>}
          </button>

          {/* Profile button */}
          <button
            type="button"
            aria-label="Perfil"
            onClick={openProfile}
            className="mt-auto flex items-center transition-opacity duration-150 hover:opacity-80"
          >
            <div className="flex w-[102px] shrink-0 items-center justify-center">
              <div className="overflow-hidden rounded-avatar border border-strong bg-[var(--text-primary)] p-0 text-contrast-token">
                <div className="flex avatar-lg items-center justify-center overflow-hidden rounded-avatar">
                  {profile?.profile_image ? (
                    <img src={profile.profile_image} alt="Foto de perfil" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <ProfileIcon className="size-[calc(var(--icon-size)+8px)]" />
                  )}
                </div>
              </div>
            </div>
            {expanded && (
              <span className="min-w-0 truncate -ml-[14px] whitespace-nowrap pr-[var(--space-4)] text-body font-[var(--fw-medium)] text-app">
                {profile?.nombre || "Perfil"}
              </span>
            )}
          </button>
        </div>
      </aside>

      <CreatePlanModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreatePlan}
      />
      <NotificationsPanel
        open={notifPanelOpen}
        onClose={() => setNotifPanelOpen(false)}
        onRead={() => setUnreadNotifs(0)}
        desktopPosition="left"
      />
      <div
        ref={searchPanelRef}
        role="dialog"
        aria-label="Buscar usuarios"
        className={`fixed left-0 top-0 z-50 hidden h-dvh w-full max-w-[360px] flex-col bg-[var(--bg)] shadow-elev-3 transition-transform duration-300 [transition-timing-function:var(--ease-standard)] md:flex ${
          searchPopoverOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-app px-5 py-4">
          <h2 className="text-body font-[var(--fw-semibold)]">Buscar</h2>
          <button
            type="button"
            onClick={() => setSearchPopoverOpen(false)}
            aria-label="Cerrar"
            className="text-muted transition-colors hover:text-app"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="border-b border-app px-5 py-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Buscar usuarios"
              className="w-full rounded-[14px] border border-app bg-surface py-3 pl-10 pr-10 text-body text-app outline-none transition-colors focus:border-[var(--border-strong)] [&::-webkit-search-cancel-button]:hidden"
            />
            {searchValue ? (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearchValue("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-opacity hover:opacity-70"
              >
                <CloseIcon className="size-[18px]" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {searchValue.trim().length < 2 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
              <SearchIcon className="size-12 opacity-20" />
              <p className="text-body-sm text-muted">Escribe al menos 2 letras para buscar usuarios.</p>
            </div>
          ) : searchLoading ? (
            <div className="flex justify-center py-12">
              <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
              <SearchIcon className="size-12 opacity-20" />
              <p className="text-body-sm text-muted">No se han encontrado usuarios.</p>
            </div>
          ) : (
            <div className="py-2">
              {searchResults.map((result) => (
                <Link
                  key={result.id}
                  href={`/profile/${result.id}`}
                  onClick={() => setSearchPopoverOpen(false)}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface)]"
                >
                  <SearchUserAvatar name={result.nombre} image={result.profile_image} />
                  <span className="min-w-0 truncate text-body-sm font-[var(--fw-semibold)] text-app">{result.nombre}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SearchUserAvatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return <img src={image} alt={name} className="size-9 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />;
  }

  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-body-sm font-[var(--fw-semibold)] text-app">
      {(name.trim()[0] || "U").toUpperCase()}
    </div>
  );
}

function HomeIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3.5 10.3L12 3.5L20.5 10.3V19A1 1 0 0 1 19.5 20H4.5A1 1 0 0 1 3.5 19V10.3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M9 20V13H15V20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PlansIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M9 3L3 6V21L9 18L15 21L21 18V3L15 6L9 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 3V18M15 6V21" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CardIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="2.8" y="4.5" width="18.4" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2.8 10.2H21.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SendIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M21 3L10 14" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M21 3L14.5 21L10 14L3 9.5L21 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PlusIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ProfileIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.8 19C7 15.9 9.1 14.4 12 14.4C14.9 14.4 17 15.9 18.2 19" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function SearchIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M6 10.5C6 7.46 8.24 5 12 5s6 2.46 6 5.5v3l1.5 2.5H4.5L6 13.5v-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 17.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
