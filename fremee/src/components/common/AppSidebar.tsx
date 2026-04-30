"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/providers/AuthProvider";
import CreatePlanModal, { type CreatePlanPayload } from "@/components/plans/modals/CreatePlanModal";
import AddGastoSheet from "@/components/plans/modals/AddGastoSheet";
import { createPlan, listUserRelatedPlans } from "@/services/api/repositories/plans.repository";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { countNotificacionesNoLeidas, insertNotificacion } from "@/services/api/repositories/notifications.repository";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { searchUsers, type PublicUserProfileDto } from "@/services/api/repositories/users.repository";
import NotificationsPanel from "@/components/notifications/NotificationsPanel";
import { Home, Map, CreditCard, Send, Plus, Search, Bell } from "lucide-react";
import { CloseX } from "@/components/ui/CloseX";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
type IconProps = {
  className?: string;
};

const HomeIcon = ({ className }: IconProps = {}) => <Home className={className} aria-hidden />;
const PlansIcon = ({ className }: IconProps = {}) => <Map className={className} aria-hidden />;
const CardIcon = ({ className }: IconProps = {}) => <CreditCard className={className} aria-hidden />;
const SendIcon = ({ className }: IconProps = {}) => <Send className={className} aria-hidden />;
const PlusIcon = ({ className }: IconProps = {}) => <Plus className={className} aria-hidden />;
const SearchIcon = ({ className }: IconProps = {}) => <Search className={className} aria-hidden />;
const CloseIcon = ({ className }: IconProps = {}) => <CloseX className={className} />;
const BellIcon = ({ className }: IconProps = {}) => <Bell className={className} aria-hidden />;

const items = [
  { key: "home", label: "Inicio", icon: HomeIcon, href: "/feed" },
  { key: "calendar", label: "Mis planes", icon: PlansIcon, href: "/calendar" },
  { key: "cards", label: "Mis gastos", icon: CardIcon, href: "/mis-gastos" },
  { key: "send", label: "Mensajes", icon: SendIcon, href: "/messages" },
];
const mobileItems = [items[0], items[2], items[1], items[3]];

type AppSidebarProps = {
  onCreatePlan?: () => void;
  onCreateConversation?: () => void;
  hideMobileNav?: boolean;
};
type MobileNavStyle = CSSProperties & { "--mobile-nav-base-height": string };

function dateInputToIso(dateInput: string, hour = 12) {
  const [year, month, day] = dateInput.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, hour, 0, 0).toISOString();
}

export default function AppSidebar({ onCreatePlan, onCreateConversation, hideMobileNav }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [modalOpen, setModalOpen] = useState(false);

  // Hide bottom nav whenever any shared app modal is open.
  useEffect(() => {
    const syncModalState = () => {
      const hasModalOverlay = document.querySelector(".app-modal-overlay") !== null;
      if (document.body.hasAttribute("data-modal-open") && !hasModalOverlay) {
        document.body.removeAttribute("data-modal-open");
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.paddingRight = "";
        document.documentElement.style.overscrollBehavior = "";
      }

      setModalOpen(
        document.body.hasAttribute("data-modal-open") ||
        document.body.hasAttribute("data-create-plan-open")
      );
    };

    syncModalState();
    const observer = new MutationObserver(() => {
      syncModalState();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-modal-open", "data-create-plan-open"] });
    return () => observer.disconnect();
  }, []);
  const [hovered, setHovered] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [mobileFabOpen, setMobileFabOpen] = useState(false);
  const [desktopCreateMenuOpen, setDesktopCreateMenuOpen] = useState(false);
  const [expensePickerOpen, setExpensePickerOpen] = useState(false);
  const [selectedExpensePlanId, setSelectedExpensePlanId] = useState<number | null>(null);
  const { isClosing: expensePickerClosing, requestClose: closeExpensePicker } = useModalCloseAnimation(() => setExpensePickerOpen(false), expensePickerOpen);
  const [expensePlans, setExpensePlans] = useState<FeedPlanItemDto[]>([]);
  const [expensePlansLoading, setExpensePlansLoading] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<PublicUserProfileDto[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const mobileFabRef = useRef<HTMLDivElement>(null);
  const desktopCreateRef = useRef<HTMLDivElement>(null);

  const { user, profile } = useAuth();

  const expanded = hovered;
  const loggedUserProfileImage = profile?.profile_image ?? null;
  const loggedUserInitial = (profile?.nombre?.trim()[0] || user?.email?.trim()[0] || "U").toUpperCase();

  useEffect(() => {
    void countNotificacionesNoLeidas().then(setUnreadNotifs).catch(() => setUnreadNotifs(0));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`notif-sidebar-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones", filter: `user_id=eq.${user.id}` },
        () => setUnreadNotifs((prev) => prev + 1)
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  useEffect(() => {
    setSearchPopoverOpen(false);
    setNotifPanelOpen(false);
    setMobileFabOpen(false);
    setDesktopCreateMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileFabOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileFabRef.current && !mobileFabRef.current.contains(e.target as Node)) {
        setMobileFabOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileFabOpen]);

  useEffect(() => {
    if (!desktopCreateMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (desktopCreateRef.current && !desktopCreateRef.current.contains(e.target as Node)) {
        setDesktopCreateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [desktopCreateMenuOpen]);

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
    if (!searchPopoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchPanelRef.current && !searchPanelRef.current.contains(e.target as Node)) {
        setSearchPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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

  const openProfile = () => {
    if (!user?.id) {
      router.push("/settings");
      return;
    }

    const isCapacitor = Capacitor.isNativePlatform();
    router.push(isCapacitor ? `/profile/static?id=${user.id}` : `/profile/${user.id}`);
  };
  const openCreatePlan = () => {
    setMobileFabOpen(false);
    setDesktopCreateMenuOpen(false);
    setExpensePickerOpen(false);
    if (onCreatePlan) {
      onCreatePlan();
      return;
    }
    setCreateModalOpen(true);
  };

  const openCreateExpense = async () => {
    setMobileFabOpen(false);
    setDesktopCreateMenuOpen(false);
    setExpensePickerOpen(true);

    if (!user?.id) {
      setExpensePlans([]);
      return;
    }

    setExpensePlansLoading(true);
    try {
      const plans = await listUserRelatedPlans({ userId: user.id, limit: 100 });
      const now = Date.now();
      setExpensePlans(
        plans
          .filter((plan) => new Date(plan.endsAt).getTime() >= now)
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      );
    } catch {
      setExpensePlans([]);
    } finally {
      setExpensePlansLoading(false);
    }
  };

  const openCreateConversation = () => {
    setMobileFabOpen(false);
    onCreateConversation?.();
  };

  const openExpenseForPlan = (planId: number) => {
    setExpensePickerOpen(false);
    setSelectedExpensePlanId(planId);
  };

  const handleExpenseCreated = () => {
    const planId = selectedExpensePlanId;
    if (planId != null) {
      window.dispatchEvent(new CustomEvent("frimee:gasto-created", { detail: { planId } }));
    }
    router.refresh();
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
    const isCapacitor = Capacitor.isNativePlatform();
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
  const mobileNavStyle: MobileNavStyle = { "--mobile-nav-base-height": "clamp(56px, 8dvh, 64px)" };

  return (
    <>
      {/* Mobile bottom nav */}
      <nav
        style={mobileNavStyle}
        className={`fixed inset-x-0 bottom-0 z-sticky flex h-[calc(var(--mobile-nav-base-height)+env(safe-area-inset-bottom))] items-center justify-around border-t border-strong bg-app px-[clamp(var(--space-4),5vw,var(--space-5))] pb-safe transition-transform duration-[var(--duration-slow)] [transition-timing-function:var(--ease-decelerate)] md:hidden ${
          hideMobileNav || modalOpen ? "translate-y-full" : "translate-y-0"
        }`}
      >
        {mobileItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-label={item.label}
            className={`${isActive(item.href) ? "text-[var(--primary)]" : "text-app"} transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)]`}
          >
            <item.icon className="size-[clamp(25px,6.4vw,28px)]" />
          </Link>
        ))}
        <button
          type="button"
          aria-label="Perfil"
          onClick={openProfile}
          className={`${pathname.startsWith("/profile") ? "text-[var(--primary)]" : "text-app"} flex size-[clamp(34px,8vw,38px)] items-center justify-center transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)]`}
        >
          {loggedUserProfileImage ? (
            <span className="block size-[clamp(31px,7.4vw,34px)] overflow-hidden rounded-full border border-strong">
              <Image src={loggedUserProfileImage} alt="Foto de perfil" width={34} height={34} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
            </span>
          ) : (
            <span className="flex size-[clamp(31px,7.4vw,34px)] items-center justify-center rounded-full border border-strong bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
              {loggedUserInitial}
            </span>
          )}
        </button>

      </nav>

      {!hideMobileNav && !modalOpen && (
        <div
          ref={mobileFabRef}
          className="fixed right-[max(16px,env(safe-area-inset-right))] bottom-[calc(clamp(56px,8dvh,64px)+env(safe-area-inset-bottom)+16px)] z-[70] flex flex-col items-end gap-3 md:hidden"
        >
          <div className={`flex flex-col items-end gap-2 transition-all duration-200 ease-out ${mobileFabOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
            <button
              type="button"
              onClick={openCreatePlan}
              aria-label="Crear plan"
              className="flex items-center gap-[var(--space-2)]"
            >
              <span className="rounded-full border border-app bg-app px-[var(--space-3)] py-[7px] text-caption font-[var(--fw-semibold)] text-app shadow-elev-2">
                Crear plan
              </span>
              <span className="flex size-14 items-center justify-center rounded-full border border-app bg-surface text-app shadow-elev-3">
                <PlansIcon className="size-6" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => void openCreateExpense()}
              aria-label="Crear gasto"
              className="flex items-center gap-[var(--space-2)]"
            >
              <span className="rounded-full border border-app bg-app px-[var(--space-3)] py-[7px] text-caption font-[var(--fw-semibold)] text-app shadow-elev-2">
                Crear gasto
              </span>
              <span className="flex size-14 items-center justify-center rounded-full border border-app bg-surface text-app shadow-elev-3">
                <CardIcon className="size-6" />
              </span>
            </button>
            {onCreateConversation && (
              <button
                type="button"
                onClick={openCreateConversation}
                aria-label="Crear conversación"
                className="flex items-center gap-[var(--space-2)]"
              >
                <span className="rounded-full border border-app bg-app px-[var(--space-3)] py-[7px] text-caption font-[var(--fw-semibold)] text-app shadow-elev-2">
                  Crear conversación
                </span>
                <span className="flex size-14 items-center justify-center rounded-full border border-app bg-surface text-app shadow-elev-3">
                  <SendIcon className="size-6" />
                </span>
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label={mobileFabOpen ? "Cerrar crear" : "Crear"}
            aria-expanded={mobileFabOpen}
            onClick={() => setMobileFabOpen((open) => !open)}
            className="flex size-14 items-center justify-center rounded-full bg-primary-token text-[var(--contrast)] shadow-[0_16px_32px_rgba(0,0,0,0.24)] transition-transform duration-200 active:scale-95"
          >
            <PlusIcon className={`size-7 transition-transform duration-200 ${mobileFabOpen ? "rotate-45" : "rotate-0"}`} />
          </button>
        </div>
      )}

      {expensePickerOpen && (
        <div
          data-closing={expensePickerClosing ? "true" : "false"}
          className="app-modal-overlay fixed inset-0 z-[1200] flex items-end justify-center px-safe pb-safe md:items-center md:p-4"
          onClick={closeExpensePicker}
          role="presentation"
        >
          <div
            className="app-modal-panel max-h-[72dvh] w-full overflow-hidden rounded-t-[22px] border border-app bg-app p-4 shadow-elev-4 md:max-h-[min(620px,82dvh)] md:max-w-[430px] md:rounded-[20px] md:p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Seleccionar plan para crear gasto"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted/30" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[18px] font-[var(--fw-semibold)] text-app">Crear gasto</h2>
                <p className="mt-1 text-body-sm text-muted">Elige el plan al que pertenece.</p>
              </div>
              <button type="button" onClick={closeExpensePicker} className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface" aria-label="Cerrar">
                <CloseIcon className="size-5" />
              </button>
            </div>
            {expensePlansLoading ? (
              <p className="py-8 text-center text-body-sm text-muted">Cargando planes...</p>
            ) : expensePlans.length > 0 ? (
              <div className="max-h-[45dvh] space-y-2 overflow-y-auto pb-2 md:max-h-[420px]">
                {expensePlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => openExpenseForPlan(plan.id)}
                    className="flex w-full items-center gap-3 rounded-[14px] border border-app bg-surface px-3 py-3 text-left transition-colors hover:bg-surface-2 active:bg-surface-2"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-token/12 text-primary-token">
                      <CardIcon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-[var(--fw-semibold)] text-app">{plan.title}</span>
                      <span className="block truncate text-caption text-muted">{plan.locationName}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="pb-2">
                <p className="py-6 text-center text-body-sm text-muted">No tienes planes activos para añadir un gasto.</p>
                <button type="button" onClick={openCreatePlan} className="flex h-11 w-full items-center justify-center rounded-full bg-primary-token text-body-sm font-[var(--fw-semibold)] text-[var(--contrast)]">
                  Crear plan
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedExpensePlanId != null && user?.id && (
        <AddGastoSheet
          planId={selectedExpensePlanId}
          userId={user.id}
          onClose={() => setSelectedExpensePlanId(null)}
          onCreated={handleExpenseCreated}
        />
      )}

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
          <div className="flex flex-1 flex-col justify-center">
          <nav className="flex w-full flex-col gap-[var(--space-8)]">
            {items.slice(0, 1).map((item) =>
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
            {items.slice(1).map((item) =>
              renderSidebarRow({
                key: item.key,
                label: item.label,
                icon: item.icon,
                href: item.href,
                active: isActive(item.href),
              })
            )}
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
          <div ref={desktopCreateRef} className="relative mt-[var(--space-14)]">
            <button
              type="button"
              aria-label="Crear"
              aria-expanded={desktopCreateMenuOpen}
              onClick={() => setDesktopCreateMenuOpen((open) => !open)}
              className={`flex h-[32px] items-center rounded-[8px] text-app transition-colors duration-150 hover:bg-surface ${desktopCreateMenuOpen ? "bg-surface" : ""}`}
            >
              <div className="flex w-[102px] shrink-0 items-center justify-center">
                <PlusIcon className="size-[26px]" />
              </div>
              {expanded && <span className="-ml-[14px] whitespace-nowrap pr-[var(--space-4)] text-body font-[var(--fw-medium)]">Crear</span>}
            </button>

            {desktopCreateMenuOpen && (
              <div className="absolute left-[14px] top-[calc(100%+8px)] z-[80] w-[184px] overflow-hidden rounded-[8px] border border-app bg-app shadow-elev-3">
                <button
                  type="button"
                  onClick={openCreatePlan}
                  className="flex h-[44px] w-full items-center justify-between gap-3 border-b border-app px-4 text-left text-body-sm text-app transition-colors hover:bg-surface"
                >
                  <span>Crear plan</span>
                  <PlansIcon className="size-5 text-muted" />
                </button>
                <button
                  type="button"
                  onClick={() => void openCreateExpense()}
                  className="flex h-[44px] w-full items-center justify-between gap-3 px-4 text-left text-body-sm text-app transition-colors hover:bg-surface"
                >
                  <span>Crear gasto</span>
                  <CardIcon className="size-5 text-muted" />
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Perfil"
            onClick={openProfile}
            className={`mt-[var(--space-8)] flex h-[32px] items-center rounded-[8px] transition-colors duration-150 hover:bg-surface ${pathname.startsWith("/profile") ? "text-[var(--primary)]" : "text-app"}`}
          >
            <div className="flex w-[102px] shrink-0 items-center justify-center">
              {loggedUserProfileImage ? (
                <span className="block size-[28px] overflow-hidden rounded-full border border-strong">
                  <Image src={loggedUserProfileImage} alt="Foto de perfil" width={28} height={28} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                </span>
              ) : (
                <span className="flex size-[28px] items-center justify-center rounded-full border border-strong bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                  {loggedUserInitial}
                </span>
              )}
            </div>
            {expanded && <span className="-ml-[14px] whitespace-nowrap pr-[var(--space-4)] text-body font-[var(--fw-medium)]">Perfil</span>}
          </button>

          </div>
        </div>
      </aside>

      <CreatePlanModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreatePlan}
        currentUserId={user?.id}
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
        <div className="px-5 pb-3 pt-5">
          <div className="flex h-[44px] items-center gap-[10px] rounded-full border border-app bg-[var(--search-field-bg)] px-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <SearchIcon className="size-[18px] shrink-0 text-muted" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Buscar usuarios"
              className="min-w-0 flex-1 border-none bg-transparent text-body text-app shadow-none outline-none ring-0 focus:border-none focus:shadow-none focus:outline-none focus:ring-0 placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
            />
            {searchValue ? (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearchValue("")}
                className="shrink-0 text-muted transition-opacity hover:opacity-70"
              >
                <CloseIcon className="size-[18px]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSearchPopoverOpen(false)}
                aria-label="Cerrar"
                className="shrink-0 text-muted transition-colors hover:text-app"
              >
                <CloseIcon className="size-[16px]" />
              </button>
            )}
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
    return <Image src={image} alt={name} width={36} height={36} className="size-9 shrink-0 rounded-full object-cover" unoptimized referrerPolicy="no-referrer" />;
  }

  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-body-sm font-[var(--fw-semibold)] text-app">
      {(name.trim()[0] || "U").toUpperCase()}
    </div>
  );
}
